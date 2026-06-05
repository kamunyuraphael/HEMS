import type { Request, Response } from "express";
import { getPredictionsByUser, ingestPrediction } from "../services/predictionService.js";
import type { IPrediction } from "../types/Prediction.d.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

export const getPredictions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const predictions = await getPredictionsByUser(userId, type as IPrediction["type"] | undefined);
    res.json(predictions);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch predictions" });
  }
};

export const addPrediction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as {
      device?: string;
      type: IPrediction["type"];
      predictedValue: number;
      confidence: number;
      targetDate: Date;
      anomalyDetails?: string;
    };

    const predictionPayload = {
      user: userId,
      type: payload.type,
      predictedValue: payload.predictedValue,
      confidence: payload.confidence,
      targetDate: payload.targetDate,
      ...(payload.device ? { device: payload.device } : {}),
      ...(payload.anomalyDetails ? { anomalyDetails: payload.anomalyDetails } : {}),
    };

    const prediction = await ingestPrediction(predictionPayload);
    res.status(201).json(prediction);
  } catch (error) {
    res.status(400).json({ error: "Failed to add prediction" });
  }
};
