// telemetryController.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Telemetry } from "../models/Telemetry.js";
import { Device } from "../models/Devices.js";
import type { ITelemetryData } from "../types/Telemetry.d.js";

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

    const interval =
      typeof req.query.interval === "string" ? req.query.interval : undefined;

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
      data: telemetry,
    });
  } catch (error) {
    next(error);
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

    const { device, watts, kWh, interval } = req.body;

    const existingDevice = await Device.findById(device);
    if (!existingDevice || existingDevice.owner.toString() !== userId) {
      res.status(403).json({
        success: false,
        error: "Device does not belong to authenticated user",
      });
      return;
    }

    const telemetry = new Telemetry({
      device: new Types.ObjectId(device),
      user: new Types.ObjectId(userId),
      watts: watts ?? 0,
      kWh,
      interval: (interval as ITelemetryData["interval"]) || "raw",
    });

    await telemetry.save();

    res.status(201).json({
      success: true,
      data: telemetry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CATEGORY CONSUMPTION BREAKDOWN
 * GET /api/telemetry/breakdown?interval=daily
 */
export const getCategoryBreakdown = async (
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

    const interval =
      typeof req.query.interval === "string" ? req.query.interval : "daily";

    const breakdown = await Telemetry.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          interval,
        },
      },
      {
        $lookup: {
          from: "devices",
          localField: "device",
          foreignField: "_id",
          as: "deviceInfo",
        },
      },
      { $unwind: "$deviceInfo" },
      {
        $group: {
          _id: "$deviceInfo.category",
          totalKWh: { $sum: "$kWh" },
          totalWatts: { $sum: "$watts" },
          readingCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalKWh: 1,
          totalWatts: 1,
          readingCount: 1,
        },
      },
      { $sort: { totalKWh: -1 } },
    ]);

    res.status(200).json({
      success: true,
      count: breakdown.length,
      data: breakdown,
    });
  } catch (error) {
    next(error);
  }
};