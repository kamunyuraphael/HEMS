// telemetryController.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Telemetry } from "../models/Telemetry.js";
import type { ITelemetryData } from "../types/Telemetry.d.js";

// Temporary extendable interface if not yet defined globally in types folder
interface AuthenticateRequest extends Request {
  user?: { id: string };
}

/**
 * FETCH TELEMETRY HISTORY
 * GET /api/telemetry?interval=raw
 */
export const getTelemetry = async (
  req: AuthenticateRequest, 
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    const interval = typeof req.query.interval === "string" ? req.query.interval : undefined;

    const filter = {
      user: new Types.ObjectId(userId),
      ...(interval ? { interval: interval as ITelemetryData["interval"] } : {}),
    };

    const telemetry = await Telemetry.find(filter)
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

    res.status(200).json({
      success: true,
      count: telemetry.length,
      data: telemetry
    });
  } catch (error) {
    next(error); // Passes securely to the centralized errorHanler middleware
  }
};

/**
 * SUBMIT RAW OR ACCUMULATED TELEMETRY TICK
 * POST /api/telemetry
 */
export const addTelemetry = async (
  req: AuthenticateRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    // Capture incoming structural metrics safely from body
    const { device, watts, kWh, interval } = req.body;

    const telemetry = new Telemetry({
      device: new Types.ObjectId(device),
      user: new Types.ObjectId(userId),
      watts: watts || 0, // Fallback if processing pre-aggregated totals
      kWh,
      interval: (interval as ITelemetryData["interval"]) || "raw",
    });

    await telemetry.save();

    res.status(201).json({
      success: true, 
      data: telemetry
      });
  } catch (error) {
    next(error);
  }
};
