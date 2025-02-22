terraform {
  required_version = "~> 1.10.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.68.0"
    }
  }
}

provider "aws" {
  region  = "ap-northeast-1"
  profile = "terraform"
  default_tags {
    tags = {
      srv = "ddr-score"
    }
  }
}

provider "aws" {
  alias  = "virginia"
  region = "us-east-1"
}
