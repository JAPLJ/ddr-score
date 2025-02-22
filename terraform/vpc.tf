resource "aws_vpc" "vpc" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

# Private subnet
resource "aws_subnet" "intra" {
  availability_zone = "ap-northeast-1a"
  cidr_block        = "10.10.100.0/24"
  vpc_id            = aws_vpc.vpc.id
}

resource "aws_route_table" "intra" {
  vpc_id = aws_vpc.vpc.id
}

resource "aws_route_table_association" "intra" {
  subnet_id      = aws_subnet.intra.id
  route_table_id = aws_route_table.intra.id
}

# Public subnet
resource "aws_subnet" "public" {
  availability_zone       = "ap-northeast-1a"
  cidr_block              = "10.10.1.0/24"
  map_public_ip_on_launch = true
  vpc_id                  = aws_vpc.vpc.id
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.vpc.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.vpc.id
}

resource "aws_route" "default_route" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.gw.id
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# S3 VPC Endpoint
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.vpc.id
  service_name = "com.amazonaws.ap-northeast-1.s3"
}

resource "aws_vpc_endpoint_route_table_association" "s3_pub" {
  route_table_id  = aws_route_table.public.id
  vpc_endpoint_id = aws_vpc_endpoint.s3.id
}

resource "aws_vpc_endpoint_route_table_association" "s3_intra" {
  route_table_id  = aws_route_table.intra.id
  vpc_endpoint_id = aws_vpc_endpoint.s3.id
}
