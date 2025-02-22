data "aws_acm_certificate" "acm" {
  provider = aws.virginia
  domain   = "ddr.ongakusei.tokyo"
}

resource "aws_route53_zone" "ddr" {
  name = "ddr.ongakusei.tokyo"
}

resource "aws_route53_record" "ddr_a" {
  zone_id = aws_route53_zone.ddr.zone_id
  name    = "ddr.ongakusei.tokyo"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.api.domain_name
    zone_id                = aws_cloudfront_distribution.api.hosted_zone_id
    evaluate_target_health = true
  }
}
