#!/bin/bash

set -e  # Exit on error

BUILD_DIR="dist"
ZIP_FILE="lambda.zip"
LAMBDA_FUNCTION_NAME="process-alerts"  # Change this to your actual Lambda function name

echo "Installing dependencies"
npm install
npm i --save-dev @types/aws-lambda @types/node

echo "Compiling TypeScript..."
npm run build  # Transpile TS to JS

echo "Creating Lambda ZIP package"
rm -f $ZIP_FILE
cd $BUILD_DIR && zip -r ../$ZIP_FILE . && cd ..
zip -r $ZIP_FILE node_modules package.json  # Include dependencies

echo "Updating AWS Lambda function"
aws lambda update-function-code \
  --function-name $LAMBDA_FUNCTION_NAME \
  --zip-file fileb://$ZIP_FILE

echo "Lambda function updated successfully"