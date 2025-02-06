output "ec2_instance_public_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_instance.alert_service_ec2.public_ip
}