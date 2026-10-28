resource "aws_key_pair" "my-key" {
  key_name   = "ec2-key"
  public_key = file("ec2-key.pub") # Path to your public key file
}
#VPC OR SECURITY GROUP
resource "aws_default_vpc" "default" {
  tags = {
    Name = "default"
  }
}
resource "aws_security_group" "my_security_group" {
  name        = "automated_security_group"
  description = "This will generate a security group for the EC2 instance"
  vpc_id      = aws_default_vpc.default.id


  #ingress rule to allow SSH access from anywhere
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["39.34.141.109/32"] # Replace with your IP address 
    description = "Allow SSH access from anywhere"
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["39.34.141.109/32"] # Replace with your IP address
    description = "Allow HTTP access from anywhere"
  }

  #outbound rule to allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1" #-1 means all protocols
    cidr_blocks = ["0.0.0.0/0"]
  }
}
#EC2 INSTANCE
resource "aws_instance" "my_ec2_instance" {

  ami             = "ami-0b6d9d3d33ba97d99" # Ubuntu 20.04 AMI (HVM), SSD Volume Type
  instance_type   = "t3.micro"
  key_name        = aws_key_pair.my-key.key_name
  vpc_security_group_ids = [aws_security_group.my_security_group.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }
  tags = {
    Name = "Ec2_Instance"
    env  = "dev"
  }

}

