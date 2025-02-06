import request from "supertest";
import { app } from "../server";
import { connectTestDB, closeTestDB } from "./testDatabase";
import Alert from "../models/Alert";
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

describe("🔹 Alert Routes", () => {
  beforeEach(async () => {
    await Alert.deleteMany(); // Clear DB before each test
  });

  it("should create a new alert", async () => {
    const response = await request(app).post("/alerts").send({
      symbol: Symbols.BTC,
      condition: ">",
      price: 150000,
    });

    expect(response.status).toBe(201);
    expect(response.body._id).toBeDefined();
    expect(response.body.symbol).toBe(Symbols.BTC);
    expect(response.body.condition).toBe(">");
    expect(response.body.price).toBe(150000);
    expect(subscribeToSymbol).toHaveBeenCalledTimes(1);
  });

  it("should retrieve all alerts", async () => {
    await Alert.create({ symbol: Symbols.ETH, condition: "<", price: 1000 });

    const response = await request(app).get("/alerts");

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].symbol).toBe(Symbols.ETH);
  });

  it("should update an alert", async () => {
    const alert = await Alert.create({
      symbol: Symbols.DOGE,
      condition: ">",
      price: 0.5,
    });

    const response = await request(app)
      .patch(`/alerts/${alert._id}`)
      .send({ price: 0.4 });

    expect(response.status).toBe(200);
    expect(response.body.price).toBe(0.4);
  });

  it("should delete an alert", async () => {
    const alert = await Alert.create({
      symbol: Symbols.BTC,
      condition: "<",
      price: 40000,
    });

    const response = await request(app).delete(`/alerts/${alert._id}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Alert deleted successfully");

    const deletedAlert = await Alert.findById(alert._id);
    expect(deletedAlert).toBeNull();
  });

  it("should return 404 for updating a non-existing alert", async () => {
    const response = await request(app)
      .patch("/alerts/000000000000000000000000")
      .send({ price: 90000 });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Alert not found");
  });

  it("should return 400 for creating an alert with invalid data", async () => {
    const response = await request(app).post("/alerts").send({
      symbol: Symbols.BTC,
      condition: "invalid", // Invalid condition
      price: "not-a-number", // Invalid price
    });

    expect(response.status).toBe(400);
  });
});
