import { connectTestDB, closeTestDB } from "./testDatabase";
import AlertService from "../services/alert";
import Alert from "../models/Alert";
import mongoose from "mongoose";
import { PriceResponse } from "../types/price";
import { Symbols } from "../types/symbols";
import { subscribeToSymbol } from "../priceTracking";

jest.mock("axios", () => ({
  get: jest.fn(() => ({
    data: {
      solana: { usd: 200 },
      cardano: { usd: 2.3 },
      bitcoin: { usd: 100000 },
      ethereum: { usd: 2800 },
      dogecoin: { usd: 0.3 },
    } as PriceResponse,
  })),
}));

jest.mock("../priceTracking", () => ({
  subscribeToSymbol: jest.fn(),
}));

beforeAll(async () => await connectTestDB());
afterAll(async () => await closeTestDB());

describe("Alert Service", () => {
  beforeEach(async () => {
    await Alert.deleteMany(); // Clear DB before each test
  });

  it("should create a new alert", async () => {
    const alert = await AlertService.createAlert({
      symbol: Symbols.BTC,
      condition: ">",
      price: 150000,
    });

    expect(alert._id).toBeDefined();
    expect(alert.symbol).toBe(Symbols.BTC);
    expect(alert.condition).toBe(">");
    expect(alert.price).toBe(150000);
    expect(alert.status).toBe("active");
    expect(subscribeToSymbol).toHaveBeenCalledTimes(1);
  });

  it("should retrieve all alerts", async () => {
    await Alert.create({ symbol: Symbols.ETH, condition: "<", price: 3000 });

    const alerts = await AlertService.getAlerts();
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("should update an alert", async () => {
    const alert = await Alert.create({
      symbol: Symbols.BTC,
      condition: ">",
      price: 130000,
    });

    const updatedAlert = await AlertService.updateAlert(alert._id.toString(), {
      price: 55000,
      condition: "<",
    });

    expect(updatedAlert).not.toBeNull();
    expect(updatedAlert?._id.toString()).toBe(alert._id.toString());
    expect(updatedAlert?.price).toBe(55000);
    expect(updatedAlert?.condition).toBe("<");
  });

  it("should delete an alert", async () => {
    const alert = await Alert.create({
      symbol: Symbols.DOGE,
      condition: ">",
      price: 0.9,
    });

    const result = await AlertService.deleteAlert(alert._id.toString());

    expect(result.message).toBe("Alert deleted successfully");

    const deletedAlert = await Alert.findById(alert._id);
    expect(deletedAlert).toBeNull();
  });

  it("should return an error if trying to update a non-existing alert", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    try {
      await AlertService.updateAlert(fakeId, {
        price: 60000,
      });
    } catch (error: any) {
      expect(error.message).toBe("Alert not found");
    }
  });

  it("should return an error if trying to update an invalid id alert", async () => {
    try {
      await AlertService.updateAlert("12345", {
        price: 60000,
      });
    } catch (error: any) {
      expect(error.message).toBe("Invalid Alert ID");
    }
  });

  it("should not create an alert if the condition is already met", async () => {
    try {
      await AlertService.createAlert({
        symbol: Symbols.BTC,
        condition: ">",
        price: 50000,
      });
    } catch (error: any) {
      expect(error.message).toContain("Invalid alert: btc is already at");
    }
  });

  it("should not update an alert if the condition is already met", async () => {
    const alert = await Alert.create({
      symbol: Symbols.BTC,
      condition: "<",
      price: 70000,
    });

    try {
      await AlertService.updateAlert(alert._id.toString(), { price: 125000 });
    } catch (error: any) {
      expect(error.message).toContain("Invalid update: btc is at");
    }
  });

  it("should not update an alert if it is already triggered", async () => {
    const alert = await Alert.create({
      symbol: Symbols.ETH,
      condition: "<",
      price: 2000,
      status: "triggered",
    });

    try {
      await AlertService.updateAlert(alert._id.toString(), { price: 1500 });
    } catch (error: any) {
      expect(error.message).toBe(
        "This alert has already been triggered and cannot be updated."
      );
    }
  });
});
