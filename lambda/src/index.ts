import { SNSEvent } from "aws-lambda";
import { processAlerts } from "./processAlerts";

// Lambda Function Handler
export const handler = async (event: SNSEvent) => {
  try {
    console.log("SNS Event:", JSON.stringify(event, null, 2));

    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      const { symbol, price } = message;

      if (!symbol || !price) {
        console.error("Missing symbol or price in SNS message");
        continue;
      }

      console.log(`Processing ${symbol} price: $${price}`);

      // Process the price update
      await processAlerts(symbol, price);
    }

    return {
      statusCode: 200,
      body: JSON.stringify("Alerts processed successfully"),
    };
  } catch (error: any) {
    console.error("Error processing alerts:", error);
    return { statusCode: 500, body: JSON.stringify(error.message) };
  }
};
