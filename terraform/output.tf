
output "instance_public_ip" {
  value       = aws_instance.my_ec2_instance.public_ip
  description = "The public IP address of the main web server."
}
