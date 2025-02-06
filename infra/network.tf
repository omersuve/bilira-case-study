# ---------------------------------------
# VPC
# ---------------------------------------
data "aws_vpc" "alert_service_vpc" {
  id = "vpc-028a99365b5c0a714"
}

# ---------------------------------------
# Public Subnets
# ---------------------------------------
resource "aws_subnet" "public" {
  count = 2  # Create two public subnets in different availability zones
  vpc_id     = data.aws_vpc.alert_service_vpc.id
  cidr_block = "10.0.${count.index}.0/24"
  map_public_ip_on_launch = true
  availability_zone = element(["eu-central-1a", "eu-central-1b"], count.index)

  tags = {
    Name = "alert-service-public-subnet-${count.index}"
  }
}

# ---------------------------------------
# Internet Gateway
# ---------------------------------------
resource "aws_internet_gateway" "alert_service_igw" {
  vpc_id = data.aws_vpc.alert_service_vpc.id
  tags = {
    Name = "alert-service-igw"
  }
}

# ---------------------------------------
# Public Route Table
# ---------------------------------------
resource "aws_route_table" "public" {
  vpc_id = data.aws_vpc.alert_service_vpc.id

  tags = {
    Name = "alert-service-public-route-table"
  }
}

resource "aws_route" "internet_access" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.alert_service_igw.id
}

resource "aws_route_table_association" "public" {
  count = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------
# Security Group
# ---------------------------------------
resource "aws_security_group" "alb_sg" {
  vpc_id      = data.aws_vpc.alert_service_vpc.id
  name        = "alert-service-alb-sg"
  description = "Allow HTTP traffic to ALB"

  # Allow HTTP traffic to the ALB
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "alert-service-alb-sg"
  }
}

resource "aws_security_group" "ecs_task_sg" {
  vpc_id      = data.aws_vpc.alert_service_vpc.id
  name        = "alert-service-ecs-sg"
  description = "Allow traffic from ALB to ECS tasks"

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "alert-service-ecs-sg"
  }
}

resource "aws_security_group_rule" "allow_alb_to_ecs" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb_sg.id
  security_group_id        = aws_security_group.ecs_task_sg.id
}