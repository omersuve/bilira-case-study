# ---------------------------------------
# Latest Image from AWS ECR
# ---------------------------------------

data aws_ecr_repository alert_service {
  name = "alert-service"
}


data aws_ecr_image latest_alert_service_image {
  repository_name = data.aws_ecr_repository.alert_service.name
  most_recent     = true
}

# ---------------------------------------
# Instance
# ---------------------------------------

resource "aws_instance" "alert_service_ec2" {
  ami           = "ami-03b3b5f65db7e5c6f"
  instance_type = "t2.micro"
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.alb_sg.id, aws_security_group.ecs_task_sg.id]

  tags = {
    Name = "AlertServiceEC2"
  }
}


# ---------------------------------------
# ECS Cluster
# ---------------------------------------
resource "aws_ecs_cluster" "alert_service_cluster" {
  name = "alert-service-cluster"
}

# ---------------------------------------
# Cloudwatch Logs
# ---------------------------------------

resource "aws_cloudwatch_log_group" "alert_service_ec2_logs" {
  name              = "/ec2/alert-service"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_stream" "alert_service_stream" {
  name           = "ecs-alert-service-log-stream"
  log_group_name = aws_cloudwatch_log_group.alert_service_ec2_logs.name
}

# ---------------------------------------
# Load Balancer
# ---------------------------------------

data "aws_lb_target_group" "alert_service_tg" {
  name = "alert-service-tg"
}

resource "aws_lb" "alert_service_lb" {
  name               = "alert-service-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_listener" "alert_service_listener" {
  load_balancer_arn = aws_lb.alert_service_lb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "forward"
    target_group_arn = data.aws_lb_target_group.alert_service_tg.arn
  }
}

# ---------------------------------------
# ECS Auto Scaling
# ---------------------------------------

resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 5  # Maximum number of tasks
  min_capacity       = 1  # Minimum number of tasks
  resource_id        = "service/${aws_ecs_cluster.alert_service_cluster.name}/${aws_ecs_service.alert_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_scaling_policy_cpu" {
  name               = "ecs-scaling-policy-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 80.0  # Scale when CPU usage reaches 50%
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}


# ---------------------------------------
# ECS Task Definition
# ---------------------------------------

data "aws_caller_identity" "current" {}

data "aws_secretsmanager_secret" "mongo_secret" {
  name = "alert-service-db"
}

resource "aws_ecs_task_definition" "alert_service_task" {
  family                   = "alert-service-task"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  container_definitions    = jsonencode([
    {
      name      = "alert-service"
      image     = "${data.aws_ecr_repository.alert_service.repository_url}@${data.aws_ecr_image.latest_alert_service_image.image_digest}"
      cpu       = 256
      memory    = 512
      essential = true
      portMappings = [{
        containerPort = 3000
        hostPort      = 3000
      }],
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.alert_service_ec2_logs.name
          awslogs-region        = "eu-central-1"
          awslogs-stream-prefix = aws_cloudwatch_log_stream.alert_service_stream.name
        }
      }
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "SNS_TOPIC_ARN", value = "${aws_sns_topic.price_alerts_topic.arn}" }
      ]
      secrets = [
        { 
          name = "MONGO_URI", 
          valueFrom = data.aws_secretsmanager_secret.mongo_secret.arn
        }
      ]
    }
  ])
}


# ---------------------------------------
# ECS Service
# ---------------------------------------
resource "aws_ecs_service" "alert_service" {
  name            = "alert-service"
  cluster         = aws_ecs_cluster.alert_service_cluster.id
  task_definition = aws_ecs_task_definition.alert_service_task.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  network_configuration {
    subnets         = aws_subnet.public[*].id
    security_groups = [aws_security_group.alb_sg.id, aws_security_group.ecs_task_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = data.aws_lb_target_group.alert_service_tg.arn
    container_name   = "alert-service"
    container_port   = 3000
  }

  deployment_controller {
    type = "ECS"
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}
