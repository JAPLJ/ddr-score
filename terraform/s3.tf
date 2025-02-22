resource "aws_s3_bucket" "s3_public" {
  bucket = "ddr-score-data-public"
}

resource "aws_s3_bucket_public_access_block" "s3_public" {
  bucket                  = aws_s3_bucket.s3_public.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "s3_public" {
  bucket = aws_s3_bucket.s3_public.id
  policy = data.aws_iam_policy_document.allow_public_access.json
}

data "aws_iam_policy_document" "allow_public_access" {
  statement {
    sid    = "PublicReadGetObject"
    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "arn:aws:s3:::${aws_s3_bucket.s3_public.id}/*"
    ]
  }
}

resource "aws_s3_bucket_website_configuration" "s3_public" {
  bucket = aws_s3_bucket.s3_public.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}
