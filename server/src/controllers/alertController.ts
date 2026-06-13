// alertController.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Alert } from "../models/Alerts.js";
import type { IAlert } from "../types/Alert.d.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

export const getAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const alerts = await Alert.find({ user: new Types.ObjectId(userId) } as any).sort({ timestamp: -1 }).lean();
    res.status(200).json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};
