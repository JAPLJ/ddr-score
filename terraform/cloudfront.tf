resource "aws_cloudfront_response_headers_policy" "cors_policy" {
  name = "CORS-Allow-All"

  cors_config {
    access_control_allow_credentials = false
    access_control_allow_origins { items = ["*"] }
    access_control_allow_methods { items = ["GET", "POST", "OPTIONS"] }
    access_control_allow_headers { items = ["*"] }
    origin_override = true
  }
}

data "aws_cloudfront_cache_policy" "asset" {
  name = "Managed-Elemental-MediaPackage"
}

resource "aws_cloudfront_cache_policy" "s3_cache" {
  name        = "S3CachePolicy"
  min_ttl     = 0
  default_ttl = 10
  max_ttl     = 10

  parameters_in_cache_key_and_forwarded_to_origin {
    headers_config {
      header_behavior = "whitelist"
      headers { items = ["Accept-Encoding"] }
    }
    cookies_config {
      cookie_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

data "aws_cloudfront_origin_request_policy" "asset" {
  name = "Managed-CORS-CustomOrigin"
}

resource "aws_cloudfront_distribution" "api" {
  origin {
    domain_name = aws_s3_bucket_website_configuration.s3_public.website_endpoint
    origin_id   = "S3Origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name              = "${aws_lambda_function_url.api.url_id}.lambda-url.ap-northeast-1.on.aws"
    origin_id                = "LambdaAPIOrigin"
    origin_access_control_id = aws_cloudfront_origin_access_control.api.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled = true
  aliases = ["${data.aws_acm_certificate.acm.domain}"]

  default_cache_behavior {
    target_origin_id       = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id = aws_cloudfront_cache_policy.s3_cache.id
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"]
    cached_methods         = ["HEAD", "GET"]
    target_origin_id       = "LambdaAPIOrigin"
    viewer_protocol_policy = "redirect-to-https"

    cache_policy_id            = data.aws_cloudfront_cache_policy.asset.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.asset.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors_policy.id
  }

  restrictions {
    geo_restriction {
      locations        = []
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = data.aws_acm_certificate.acm.arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1"
  }
}

resource "aws_cloudfront_origin_access_control" "api" {
  name                              = "lambda-oac"
  description                       = "lambda-oac"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
