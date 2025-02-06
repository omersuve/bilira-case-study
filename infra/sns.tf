# SNS Topic
resource "aws_sns_topic" "price_alerts_topic" {
  name = "price-alerts-topic"
}

# SNS Subscription for Lambda
resource "aws_sns_topic_subscription" "lambda_sns_subscription" {
  topic_arn = aws_sns_topic.price_alerts_topic.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.process_alerts_lambda.arn
}

# Allow SNS to invoke the Lambda function
resource "aws_lambda_permission" "allow_sns" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.process_alerts_lambda.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.price_alerts_topic.arn
}
