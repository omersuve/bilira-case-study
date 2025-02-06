# Price Alert Service

## Features

- Fetches real-time crypto prices (once every 3 seconds per symbol)
- Allows setting price alerts
- Provides a REST API for managing alerts
- Secure database storage for alerts
- Scalable infrastructure on AWS

#### Supported symbols

- sol
- btc
- eth
- doge
- ada
- xrp

#### Available host to test

`http://alert-service-alb-1399958634.eu-central-1.elb.amazonaws.com`

## Setup Instructions

#### Prerequisites

- Node.js (v22+)
- MongoDB (local instance or MongoDB Atlas)
- AWS Credentials (for sending alerts via SNS)
- Terraform installed (for infrastructure as code)
- `.env` file with required configurations

#### Build and Run

```sh
# Build the Docker image
docker build -t alert-service .

# Run the container
docker run -p 3000:3000 --env-file .env --name alert-container alert-service
```

#### Environment Variables

```env
PORT=3000
MONGO_URI=mongodb+srv://username:password@your-cluster.mongodb.net/alert-service
SNS_TOPIC_ARN=arn:aws:sns:eu-central-1:140595603548:price-alerts-topic
```

### Deployment

#### AWS Secrets

- The **MongoDB URI** is stored as **plain text** under the secret name `alert-service-db`
- **Secret Value (Plain Text Example):** `mongodb+srv://username:password@your-cluster.mongodb.net/alert-service`

#### Deploying Alert Service (ECS)

```sh
chmod +x deploy.sh
./deploy.sh  # Deploys the latest version to AWS ECS
```

#### Deploying Lambda Function

```sh
cd lambda
chmod +x deploy.sh
./deploy.sh  # Packages & deploys the Lambda function
```

#### Applying Terraform Configuration

```sh
cd infra
terraform init
terraform apply -auto-approve
```

## API Documentation

Postman collection is available

### Endpoints

| Method | Endpoint      | Description        |
| ------ | ------------- | ------------------ |
| POST   | `/alerts`     | Create a new alert |
| GET    | `/alerts`     | Retrieve alerts    |
| GET    | `/alerts/:id` | Retrieve an alert  |
| UPDATE | `/alerts/:id` | Change an alert    |
| DELETE | `/alerts/:id` | Delete an alert    |

A Postman collection is available in `./alert-service.postman_collection.json`.

## Architecture and Design

### Tech Stack

- **Backend:** Node.js with Express.js
- **Database:** MongoDB with Mongoose
- **Realtime Price Stream:** Binance Websocket
- **Deployment:** AWS ECS-SNS-Lambda with Terraform
- **CI/CD:** GitHub Actions

### Design Decisions

- **MongoDB for Scalability & Flexibility**

  - NoSQL model enables faster writes and horizontal scaling, making it ideal for real-time applications.
  - Scales horizontally across multiple nodes, ensuring high availability and performance.
  - Suitable for event-driven systems.

- **Event-Driven Architecture (SNS & Lambda)**

  - Uses AWS SNS for decoupling price updates and alert processing.
  - AWS Lambda is triggered asynchronously, allowing real-time notifications without overloading the API.
  - This reduces latency and ensures alerts are processed efficiently.

- **Containerized Deployment (Docker & AWS ECS)**

  - Dockerized to ensure consistency across environments.
  - AWS Fargate (ECS) eliminates the need for managing EC2 instances.

- **Security Best Practices**

  - AWS Secrets Manager securely manages the MongoDB connection string.

- **Automated CI/CD (GitHub Actions & Terraform)**

  - GitHub Actions runs unit tests & integration tests before deployment.
  - Terraform automates infrastructure setup (SNS, Lambda, ECS, IAM roles).

- **Observability & Logging (CloudWatch)**
  - Logs are stored in AWS CloudWatch.

## CI/CD and Deployment

### CI/CD Workflow

- GitHub Actions automates testing and deployment.
- Each push or pr approve to the main branch triggers a build and test pipeline.
- Successful builds are automatically deployed to AWS.

### Deployment Strategy

- Uses Dockerized containers for consistency.
- Deployed on AWS Fargate for scalability.
- Environment variables are managed securely using AWS Secrets Manager.
