output "name_servers" {
  description = "NS records"
  value       = aws_route53_zone.ddr.name_servers
}

output "bat_instance_id" {
  description = "EC2 instance id"
  value       = aws_instance.bat.id
}

output "api_function_name" {
  description = "API Lambda function name"
  value       = aws_lambda_function.api.function_name
}

output "api_function_image_uri" {
  description = "API Lambda function image uri"
  value       = aws_lambda_function.api.image_uri
}

output "api_private_function_name" {
  description = "API(Private) Lambda function name"
  value       = aws_lambda_function.api_private.function_name
}

output "api_private_function_image_uri" {
  description = "API(Private) Lambda function image uri"
  value       = aws_lambda_function.api_private.image_uri
}
