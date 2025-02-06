terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "bilira"
    key    = "alert-service/terraform.tfstate"
    region = "eu-central-1"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "default"
}
