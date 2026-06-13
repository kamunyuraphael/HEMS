// mlController.ts
import type { Request, Response, NextFunction } from "express";
import { ingestPrediction } from "../services/predictionService.js";
import { getIO } from '../utils/socketEvents.js';
import logger from '../utils/logger.js';
import type { AlertEventPayload } from '../types/SocketEvents.d.js';

export const mlPredictionWebhook = async (req: Request, res: Response, next: NextFunction) => {
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
      const alertPayload: AlertEventPayload = {
        type: "anomaly",
        message: "An energy anomaly was detected!",
        anomalyDetails: payload.anomalyDetails,
        timestamp: new Date(),
      };

      io.to(payload.userId).emit("alert", alertPayload);
      logger.info(`Alert emitted to user ${payload.userId}: ${payload.anomalyDetails}`);
    }

    res.status(201).json({ success: true, message: "ML prediction ingested successfully", data: prediction });
  } catch (error) {
    next(error);
  }
};
