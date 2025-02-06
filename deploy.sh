#!/bin/bash

set -e

# Set variables
AWS_REGION="eu-central-1"  # Change if needed
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPOSITORY_NAME="alert-service"
IMAGE_TAG="latest"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY_NAME:$IMAGE_TAG"
CLUSTER_NAME="alert-service-cluster"
SERVICE_NAME="alert-service"

# Set environment variables
NODE_ENV="production"
PORT="3000"

# Retrieve the SNS Topic ARN dynamically from AWS
SNS_TOPIC_ARN=$(aws sns list-topics --query "Topics[?contains(TopicArn, 'price-alerts-topic')].TopicArn" --output text --region $AWS_REGION)

if [ -z "$SNS_TOPIC_ARN" ]; then
  echo "Failed to retrieve SNS Topic ARN"
  exit 1
fi

# Retrieve the full ARN of the secret dynamically
MONGO_URI_ARN=$(aws secretsmanager list-secrets --query "SecretList[?Name=='alert-service-db'].ARN" --output text --region eu-central-1)

if [ -z "$MONGO_URI_ARN" ]; then
  echo "Failed to retrieve the arn for the secret 'alert-service-db'"
  exit 1
fi

echo "Building and pushing Docker image to AWS ECR..."

# Authenticate with AWS ECR
echo "Logging in to AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Check if the repository exists, if not, create it
echo "Checking if ECR repository exists..."
aws ecr describe-repositories --repository-names "$REPOSITORY_NAME" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Repository $REPOSITORY_NAME does not exist. Creating..."
    aws ecr create-repository --repository-name "$REPOSITORY_NAME"
fi

# Build the Docker image
echo "Building Docker image..."
docker build --platform=linux/amd64 -t "$REPOSITORY_NAME" .

# Tag the image
echo "Tagging image..."
docker tag "$REPOSITORY_NAME:latest" "$ECR_URI"

# Push the image to AWS ECR
echo "Pushing image to AWS ECR..."
docker push "$ECR_URI"

echo "Image pushed successfully: $ECR_URI"

# Get the current task definition
TASK_DEFINITION=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query "services[0].taskDefinition" --output text)

# Create a new revision of the task definition with the new image
NEW_TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_DEFINITION --query "taskDefinition" --output json | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

UPDATED_TASK_DEF=$(echo "$NEW_TASK_DEF" | jq --arg IMAGE "$ECR_URI" \
  --arg NODE_ENV "$NODE_ENV" \
  --arg PORT "$PORT" \
  --arg MONGO_URI "$MONGO_URI_ARN" \
  --arg SNS_TOPIC_ARN "$SNS_TOPIC_ARN" '
  .containerDefinitions[0].image = $IMAGE |
  .containerDefinitions[0].environment = [
    { "name": "NODE_ENV", "value": $NODE_ENV },
    { "name": "PORT", "value": $PORT },
    { "name": "SNS_TOPIC_ARN", "value": $SNS_TOPIC_ARN }
  ] |
  .containerDefinitions[0].secrets = [
    { "name": "MONGO_URI", "valueFrom": $MONGO_URI }
  ]')


# Register the new task definition
NEW_TASK_ARN=$(aws ecs register-task-definition --cli-input-json "$UPDATED_TASK_DEF" --query "taskDefinition.taskDefinitionArn" --output text)

# Update ECS to use the new task definition
aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --task-definition $NEW_TASK_ARN

# Force ECS to restart all tasks so the new image is applied immediately
aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment

echo "New task is now running with the latest image!"