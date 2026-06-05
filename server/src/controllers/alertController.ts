// alertController.ts
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Alert } from "../models/Alerts.js";
import type { IAlert } from "../types/Alert.d.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

export const getAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const alerts = await Alert.find({ user: new Types.ObjectId(userId) } as any).sort({ timestamp: -1 }).lean();
    res.json(alerts);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch alerts" });
  }
};
