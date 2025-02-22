resource "aws_efs_file_system" "db" {}

resource "aws_security_group" "db_pub" {
  vpc_id = aws_vpc.vpc.id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.bat.id, aws_vpc.vpc.default_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_efs_mount_target" "db_pub" {
  file_system_id  = aws_efs_file_system.db.id
  subnet_id       = aws_subnet.public.id
  security_groups = [aws_security_group.db_pub.id]
}

resource "aws_efs_file_system_policy" "db" {
  file_system_id = aws_efs_file_system.db.id
  policy         = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite"
      ],
      "Principal": {
        "AWS": "*"
      }
    }
  ]
}
EOF
}

resource "aws_efs_access_point" "db" {
  file_system_id = aws_efs_file_system.db.id

  posix_user {
    gid = 1000
    uid = 1000
  }

  root_directory {
    path = "/db"
    creation_info {
      owner_gid   = 1000
      owner_uid   = 1000
      permissions = "0777"
    }
  }
}
