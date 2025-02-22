data "aws_iam_policy_document" "api_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

# Public API
resource "aws_iam_role" "api_lambda" {
  name               = "api_lambda"
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json
}

resource "aws_iam_role_policy_attachment" "api_lambda_basic" {
  role       = aws_iam_role.api_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "api_lambda_s3" {
  role       = aws_iam_role.api_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_lambda_function" "api" {
  function_name = "ddr-score-data-api"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:latest"
  role          = aws_iam_role.api_lambda.arn
  timeout       = 10

  vpc_config {
    subnet_ids         = [aws_subnet.intra.id]
    security_group_ids = [aws_vpc.vpc.default_security_group_id]
  }

  file_system_config {
    arn              = aws_efs_access_point.db.arn
    local_mount_path = "/mnt/efs"
  }

  environment {
    variables = {
      "DATABASE_URL" = "sqlite:/mnt/efs/db/ddr_score.db"
      "S3_BUCKET"    = aws_s3_bucket.s3_public.bucket
    }
  }

  depends_on = [aws_efs_mount_target.db_pub]
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "AWS_IAM"
}

resource "aws_lambda_permission" "allow_cloudfront" {
  statement_id  = "AllowCloudFrontServicePrincipal"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.api.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.api.arn
}

# Private API
resource "aws_iam_role" "api_lambda_private" {
  name               = "api_lambda_private"
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json
}

resource "aws_iam_role_policy_attachment" "api_lambda_private_basic" {
  role       = aws_iam_role.api_lambda_private.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_lambda_function" "api_private" {
  function_name = "ddr-score-data-api-private"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api_private.repository_url}:latest"
  role          = aws_iam_role.api_lambda_private.arn

  vpc_config {
    subnet_ids         = [aws_subnet.intra.id]
    security_group_ids = [aws_vpc.vpc.default_security_group_id]
  }

  file_system_config {
    arn              = aws_efs_access_point.db.arn
    local_mount_path = "/mnt/efs"
  }

  environment {
    variables = {
      "DATABASE_URL" = "sqlite:/mnt/efs/db/ddr_score.db"
    }
  }

  depends_on = [aws_efs_mount_target.db_pub]
}

resource "aws_lambda_function_url" "api_private" {
  function_name      = aws_lambda_function.api_private.function_name
  authorization_type = "AWS_IAM"
}

resource "aws_lambda_permission" "allow_ec2" {
  statement_id  = "AllowEC2ServicePrincipal"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.api_private.function_name
  principal     = "ec2.amazonaws.com"
  source_arn    = aws_instance.bat.arn
}
