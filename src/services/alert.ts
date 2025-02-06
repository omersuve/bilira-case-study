import mongoose from "mongoose";
import Alert, { IAlert } from "../models/Alert";
import axios from "axios";
import { PriceResponse } from "../types/price";
import { subscribeToSymbol } from "../priceTracking";
import { SymbolNames, Symbols } from "../types/symbols";

/**
 * Fetch the latest price for a given symbol.
 */
export const getCurrentPrice = async (symbol: Symbols): Promise<number> => {
  try {
    const response = await axios.get<PriceResponse>(
      `https://api.coingecko.com/api/v3/simple/price?ids=${SymbolNames[symbol]}&vs_currencies=usd`
    );
    return response.data[SymbolNames[symbol]].usd;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    throw new Error(`Failed to retrieve price for ${symbol}`);
  }
};

/**
 * Create a new price alert.
 */
const createAlert = async (data: {
  symbol: string;
  condition: ">" | "<";
  price: number;
}): Promise<IAlert> => {
  if (!Object.values(Symbols).includes(data.symbol as Symbols)) {
    throw new Error(
      `Invalid symbol: ${data.symbol}. Allowed symbols are ${Object.values(
        Symbols
      ).join(", ")}.`
    );
  }

  // Convert symbol to enum type
  const symbolEnum: Symbols = data.symbol as Symbols;

  // Fetch the current price of the asset
  const currentPrice = await getCurrentPrice(symbolEnum);

  // Validate the alert condition
  if (
    (data.condition === ">" && data.price <= currentPrice) ||
    (data.condition === "<" && data.price >= currentPrice)
  ) {
    throw new Error(
      `Invalid alert: ${data.symbol} is already at ${currentPrice}, which satisfies your condition ${data.condition} ${data.price}.`
    );
  }

  // Create the alert in the database
  const newAlert = await Alert.create({ ...data, symbol: symbolEnum });

  // Subscribe to WebSocket if it's a new symbol
  const numberOfAlertsForSymbol = await Alert.countDocuments({
    symbol: symbolEnum,
  });
  if (numberOfAlertsForSymbol === 1) {
    console.log(
      `New symbol detected: ${data.symbol}. Subscribing to WebSocket...`
    );
    subscribeToSymbol(symbolEnum); // Adjust format for Binance
  }

  return newAlert;
};

/**
 * Retrieve all price alerts.
 */
const getAlerts = async (): Promise<IAlert[]> => {
  return await Alert.find();
};

/**
 * Get an alert by ID
 */
const getAlertById = async (id: string): Promise<IAlert | null> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid Alert ID");
  }

  return await Alert.findById(id);
};

/**
 * Retrieve all active price alerts.
 */
const getActiveAlerts = async (): Promise<IAlert[]> => {
  return await Alert.find({ status: "active" });
};

/**
 * Retrieve active alerts for a given cryptocurrency symbol.
 * @param symbol - The cryptocurrency symbol (e.g., "btc").
 * @returns A list of active alerts for the given symbol.
 */
const getActiveAlertsForSymbol = async (symbol: Symbols): Promise<IAlert[]> => {
  return await Alert.find({ symbol: symbol.toLowerCase(), status: "active" });
};

/**
 * Retrieve all alerts for a specific symbol.
 * @param symbol - The cryptocurrency symbol (e.g., "btc", "eth").
 */
const getAlertsForSymbol = async (symbol: Symbols): Promise<IAlert[]> => {
  return await Alert.find({ symbol: symbol.toLowerCase() });
};

/**
 * Update an existing price alert.
 */
const updateAlert = async (
  id: string,
  updateData: Partial<Pick<IAlert, "price" | "condition">>
): Promise<IAlert | null> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid Alert ID");
  }

  const existingAlert = await Alert.findById(id);
  if (!existingAlert) {
    throw new Error("Alert not found");
  }

  // Prevent updates if the alert has already been triggered
  if (existingAlert.status === "triggered") {
    throw new Error(
      "This alert has already been triggered and cannot be updated."
    );
  }

  const allowedUpdates = ["price", "condition"];
  const keys = Object.keys(updateData);
  const isValidUpdate = keys.every((key) => allowedUpdates.includes(key));

  if (!isValidUpdate) {
    throw new Error(
      `Invalid update: Only 'price' and 'condition' can be updated.`
    );
  }

  // If price/condition is updated, validate it
  if (updateData.price !== undefined || updateData.condition !== undefined) {
    const currentPrice = await getCurrentPrice(existingAlert.symbol);
    console.log("currentPrice", currentPrice);
    const newPrice = updateData.price ?? existingAlert.price;
    const newCondition = updateData.condition ?? existingAlert.condition;

    if (
      (newCondition === ">" && newPrice <= currentPrice) ||
      (newCondition === "<" && newPrice >= currentPrice)
    ) {
      throw new Error(
        `Invalid update: ${existingAlert.symbol} is at ${currentPrice}, which satisfies your new condition ${newCondition} ${newPrice}.`
      );
    }
  }

  // Update the alert
  return await Alert.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

/**
 * Delete an alert by ID.
 */
const deleteAlert = async (id: string): Promise<{ message: string }> => {
  const deletedAlert = await Alert.findByIdAndDelete(id);

  if (!deletedAlert) {
    throw new Error("Alert not found");
  }

  return { message: "Alert deleted successfully" };
};

export default {
  createAlert,
  getAlerts,
  getAlertById,
  getActiveAlerts,
  getAlertsForSymbol,
  getActiveAlertsForSymbol,
  updateAlert,
  deleteAlert,
};
