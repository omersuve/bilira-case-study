import { MongoClient } from "mongodb";
import AWS from "aws-sdk";

const secretsManager = new AWS.SecretsManager();
let cachedClient: MongoClient | null = null;
let cachedMongoUri: string | null = null;

const DB_NAME = "alert-service"; // Update if needed
const COLLECTION_NAME = "alerts"; // Your alerts collection

/**
 * Fetch the MongoDB URI from AWS Secrets Manager (Plain Text Secret)
 */
const getMongoUri = async (): Promise<string> => {
  if (cachedMongoUri) {
    console.log("Using cached MongoDB URI");
    return cachedMongoUri;
  }

  console.log("Fetching MongoDB URI from Secrets Manager");

  try {
    const secretData = await secretsManager
      .getSecretValue({ SecretId: process.env.MONGO_URI as string }) // MONGO_URI contains ARN
      .promise();

    if (!secretData.SecretString) {
      throw new Error("SecretString is empty");
    }

    cachedMongoUri = secretData.SecretString.trim(); // Direct plain text secret
    return cachedMongoUri;
  } catch (error) {
    console.error("Error retrieving MongoDB URI:", error);
    throw new Error("Failed to retrieve MongoDB connection string");
  }
};

/**
 * Get a shared MongoDB connection (Prevents Too Many Open Connections)
 */
const getMongoClient = async (): Promise<MongoClient> => {
  if (cachedClient) {
    console.log("Using cached MongoDB connection");
    return cachedClient;
  }

  const mongoUri = await getMongoUri(); // Always a string now

  console.log("Creating a new MongoDB connection...");
  cachedClient = new MongoClient(mongoUri, { monitorCommands: true });
  await cachedClient.connect();
  return cachedClient;
};

/**
 * Processes alerts based on received price update.
 */
export const processAlerts = async (symbol: string, price: number) => {
  console.log(`Checking alerts for ${symbol} at $${price}`);

  const client = await getMongoClient();
  const db = client.db(DB_NAME);
  const alertsCollection = db.collection(COLLECTION_NAME);

  // Fetch active alerts for the symbol
  const activeAlerts = await alertsCollection
    .find({ symbol, status: "active" })
    .toArray();

  if (activeAlerts.length === 0) {
    console.log(`No active alerts for ${symbol}, skipping.`);
    return;
  }

  const alertsToTrigger = activeAlerts.filter((alert) => {
    return (
      (alert.condition === ">" && price > alert.price) ||
      (alert.condition === "<" && price < alert.price)
    );
  });

  if (alertsToTrigger.length === 0) {
    console.log(`No alerts triggered for ${symbol} at $${price}`);
    return;
  }

  // Update triggered alerts
  const alertIds = alertsToTrigger.map((alert) => alert._id);
  await alertsCollection.updateMany(
    { _id: { $in: alertIds } },
    { $set: { status: "triggered", triggeredAt: new Date() } }
  );

  console.log(
    `${alertsToTrigger.length} alerts triggered for ${symbol} at $${price}`
  );
};
