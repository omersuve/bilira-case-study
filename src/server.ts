import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/mongo";
import alertRoutes from "./routes/alert";
import { startPriceWorker } from "./priceTracking";

dotenv.config();

export const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Routes
app.use("/alerts", alertRoutes);

// Connect to MongoDB only if NOT in test mode
if (process.env.NODE_ENV !== "test") {
  connectDB().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startPriceWorker(); // Start fetching prices in the background
    });
  });
}
