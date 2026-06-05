import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Device } from "../models/Devices.js";
import { User } from "../models/User.js";
import type { IDevice } from "../types/Device.d.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

export const addDevice = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, category } = req.body as Pick<IDevice, "name" | "category">;
    const device = new Device({
      name,
      category,
      owner: new Types.ObjectId(userId),
    });
    await device.save();

    await User.findByIdAndUpdate(userId, { $push: { devices: device._id } });

    res.status(201).json(device);
  } catch (error) {
    res.status(400).json({ error: "Failed to add device" });
  }
};

export const deleteDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await Device.findByIdAndDelete(id);
    await User.findByIdAndUpdate(req.user?.id, { $pull: { devices: id } });

    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: "Failed to delete device" });
  }
};

export const getDevices = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const devices = await Device.find({ owner: new Types.ObjectId(userId) } as any).lean();
    res.json(devices);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch devices" });
  }
};
