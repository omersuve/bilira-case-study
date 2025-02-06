import express, { Request, Response } from "express";
import alertService from "../services/alert";

const router = express.Router();

// Create an alert
router.post("/", async (req: Request, res: Response) => {
  try {
    const alert = await alertService.createAlert(req.body);
    res.status(201).json(alert);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all alerts
router.get("/", async (_req: Request, res: Response) => {
  try {
    const alerts = await alertService.getAlerts();
    res.json(alerts);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get an alert by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const alert = await alertService.getAlertById(req.params.id);
    res.json(alert);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update an alert (PATCH)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const updatedAlert = await alertService.updateAlert(
      req.params.id,
      req.body
    );
    res.json(updatedAlert);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Delete an alert
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await alertService.deleteAlert(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

export default router;
