import { Types } from "mongoose";
import { Telemetry } from "../models/Telemetry.js";
import type { ITelemetryData } from "../types/Telemetry.d.js";

export interface TelemetryInput {
  device: string;
  kWh: number;
  interval: ITelemetryData["interval"];
}

export const createTelemetryForUser = async (userId: string, payload: TelemetryInput) => {
  try {
    const telemetry = new Telemetry({
      device: new Types.ObjectId(payload.device),
      user: new Types.ObjectId(userId),
      kWh: payload.kWh,
      interval: payload.interval,
    });
    await telemetry.save();
    return telemetry;
  } catch (error) {
    console.error("Failed to add telemetry:", error);
    throw error;
  }
};

export const getTelemetryByInterval = async (userId: string, interval?: string) => {
  try {
    const filter: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
    };

    if (interval) {
      filter.interval = interval as ITelemetryData["interval"];
    }

    const telemetry = await Telemetry.find(filter as any)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    return telemetry;
  } catch (error) {
    console.error("Failed to fetch telemetry:", error);
    throw error;
  }
};

// Example: Aggregate consumption by category
export const getCategoryBreakdown = async (userId: string, interval: string) => {
  try {
    const breakdown = await Telemetry.aggregate([
      { $match: { user: new Types.ObjectId(userId), interval } },
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
        },
      },
    ]);
    return breakdown;
  } catch (error) {
    console.error("Failed to aggregate telemetry:", error);
    throw error;
  }
};
