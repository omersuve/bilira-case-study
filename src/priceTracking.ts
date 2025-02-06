import WebSocket from "ws";
import dotenv from "dotenv";
import alertService from "./services/alert";
import { BinanceMarkPriceMessage } from "./types/binance";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { Symbols } from "./types/symbols";

dotenv.config();

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || "eu-central-1",
  ...(process.env.NODE_ENV !== "production"
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }
    : {}),
});

// Map to store WebSocket connections per symbol
const priceSockets: Record<string, WebSocket> = {};

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN as string; // Set in .env

/**
 * Publish price updates to AWS SNS (instead of invoking Lambda directly).
 */
const sendToSNS = async (symbol: string, price: number) => {
  const payload = JSON.stringify({ symbol, price });

  if (!SNS_TOPIC_ARN) {
    console.error("SNS_TOPIC_ARN is not set in environment variables.");
    return;
  }

  const params = {
    TopicArn: SNS_TOPIC_ARN,
    Message: payload,
  };

  try {
    await snsClient.send(new PublishCommand(params));
    console.log(`Published ${symbol} price ($${price}) to SNS.`);
  } catch (error) {
    console.error(`Failed to publish ${symbol} price to SNS:`, error);
  }
};

/**
 * Start real-time price tracking for active alerts
 */
export const startPriceWorker = async () => {
  try {
    console.log("Starting real-time price tracking...");

    // Get all unique crypto symbols from active alerts in the database
    const activeAlerts = await alertService.getActiveAlerts();
    const symbols: Symbols[] = [
      ...new Set(
        activeAlerts
          .map((alert) => alert.symbol.toLowerCase())
          .filter((symbol): symbol is Symbols =>
            Object.values(Symbols).includes(symbol as Symbols)
          )
      ),
    ];

    if (symbols.length === 0) {
      console.log("No active alerts found. WebSocket not started.");
      return;
    }

    // Subscribe to WebSocket for each unique symbol
    symbols.forEach((symbol) => subscribeToSymbol(symbol));
  } catch (error) {
    console.error("Error starting price worker:", error);
  }
};

/**
 * Dynamically subscribe to a new symbol's WebSocket if not already subscribed
 */
export const subscribeToSymbol = (symbol: Symbols) => {
  if (priceSockets[symbol]) {
    console.log(
      `⚠️ Already tracking ${symbol.toUpperCase()}, skipping duplicate subscription.`
    );
    return;
  }

  const ws = new WebSocket(
    `wss://fstream.binance.com/ws/${symbol}usdt@markPrice`
  );
  priceSockets[symbol] = ws;

  ws.on("open", () =>
    console.log(`Connected to Binance WebSocket for ${symbol}`)
  );

  ws.on("message", async (data: string) => {
    try {
      const parsedData: BinanceMarkPriceMessage = JSON.parse(data);
      const price = parseFloat(parsedData.p); // "p" is the last traded price

      console.log(`${symbol.toUpperCase()} Price: $${price}`);

      // Publish the price to AWS SNS
      await sendToSNS(symbol, price);
    } catch (error) {
      console.error("Error parsing Binance WebSocket message:", error);
    }
  });

  ws.on("error", (err) => console.error(`WebSocket Error (${symbol}):`, err));

  ws.on("close", async () => {
    console.log(`Disconnected from Binance WebSocket (${symbol})`);
    delete priceSockets[symbol];

    // Check if we still need to track this symbol
    const remainingAlerts = await alertService.getAlertsForSymbol(symbol);
    if (remainingAlerts.length === 0) {
      console.log(
        `No more active alerts for ${symbol.toUpperCase()}, unsubscribing.`
      );
    } else {
      // Reconnect
      subscribeToSymbol(symbol);
    }
  });
};
