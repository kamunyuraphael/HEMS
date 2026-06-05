// mlController.ts
import type { Request, Response } from "express";
import { ingestPrediction } from "../services/predictionService.js";
import { getIO } from '../utils/socketEvents.js';

export const mlPredictionWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    const prediction = await ingestPrediction({
      user: payload.userId,
      device: payload.device,
      type: payload.type,
      predictedValue: payload.predictedValue,
      confidence: payload.confidence,
      targetDate: payload.targetDate,
      anomalyDetails: payload.anomalyDetails,
    });

    // If an anomaly is detected, push a notification via Socket.io
    const io = getIO();
    
    if (payload.anomalyDetails && payload.userId) {
      // Use the allowed event name "alert" to satisfy Socket.IO typings
      const alertPayload = {
        type: "anomaly",
        message: "An energy anomaly was detected!",
        anomalyDetails: payload.anomalyDetails,
        timestamp: new Date(),
      } as any;

      io.to(payload.userId).emit("alert", alertPayload);
    }

    res.status(201).json({ success: true, data: prediction });
  } catch (error) {
    console.error("ML prediction webhook failed:", error);
    res.status(500).json({ error: "Failed to ingest ML prediction" });
  }
};
