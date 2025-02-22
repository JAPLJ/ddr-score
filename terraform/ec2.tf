# Key pair
variable "key_name" {
  type    = string
  default = "ddr-score-key"
}

locals {
  public_key_file  = "./.key_pair/${var.key_name}.id_rsa.pub"
  private_key_file = "./.key_pair/${var.key_name}.id_rsa"
}

resource "tls_private_key" "keygen" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_file" "private_key_pem" {
  filename = local.private_key_file
  content  = tls_private_key.keygen.private_key_pem
  provisioner "local-exec" {
    command = "chmod 600 ${local.private_key_file}"
  }
}

resource "local_file" "public_key_openssh" {
  filename = local.public_key_file
  content  = tls_private_key.keygen.public_key_openssh
  provisioner "local-exec" {
    command = "chmod 600 ${local.public_key_file}"
  }
}

resource "aws_key_pair" "key_pair" {
  key_name   = var.key_name
  public_key = tls_private_key.keygen.public_key_openssh
}

# EC2
resource "aws_security_group" "bat" {
  vpc_id = aws_vpc.vpc.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "bat" {
  ami                    = "ami-057545744a535e74f"
  vpc_security_group_ids = [aws_security_group.bat.id]
  subnet_id              = aws_subnet.public.id
  key_name               = aws_key_pair.key_pair.id
  instance_type          = "t4g.micro"

  lifecycle {
    ignore_changes = [user_data]
  }
  user_data = <<EOF
#!/bin/bash
yum -y install wget
if [[ "$(python3 -V 2>&1)" =~ ^(Python 3.6.*) ]]; then
    wget https://bootstrap.pypa.io/pip/3.6/get-pip.py -O /tmp/get-pip.py
elif [[ "$(python3 -V 2>&1)" =~ ^(Python 3.5.*) ]]; then
    wget https://bootstrap.pypa.io/pip/3.5/get-pip.py -O /tmp/get-pip.py
elif [[ "$(python3 -V 2>&1)" =~ ^(Python 3.4.*) ]]; then
    wget https://bootstrap.pypa.io/pip/3.4/get-pip.py -O /tmp/get-pip.py
else
    wget https://bootstrap.pypa.io/get-pip.py -O /tmp/get-pip.py
fi
python3 /tmp/get-pip.py
pip3 install botocore || /usr/local/bin/pip3 install botocore

yum install -y amazon-efs-utils
mkdir -p /mnt/efs
mount -t efs -o tls,accesspoint=${aws_efs_access_point.db.id} ${aws_efs_file_system.db.id}:/ /mnt/efs

echo ${aws_efs_file_system.db.id}:/ /mnt/efs efs _netdev,noresvport,nofail,tls,iam,accesspoint=${aws_efs_access_point.db.id} 0 0 >> /etc/fstab

yum install -y sqlite
EOF

  depends_on = [aws_efs_mount_target.db_pub]
}
