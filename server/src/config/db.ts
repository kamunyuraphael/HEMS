import { z } from "zod";
import { Types } from "mongoose";
import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 5000;
        if (MONGODB_URI!) {
            throw new Error("MongoDB connection string is not configured. Set MONGO_URI")
        }

        const conn = await mongoose.connect(MONGODB_URI, {
            autoIndex: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        }
        process.exit(1);
    }
};

// Helper validator ensuring a string parameter is a valid MongoDB ObjectId
const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid unique identifier format",
});

/* ---------------- ID PARAMETERS SCHEMA ---------------- */
export const idParamSchema = z.object({
  id: objectIdSchema,
});

/* ---------------- AUTH SCHEMAS ---------------- */
export const registerSchema = z.object({
  name: z.string().min(2, "Name must contain at least 2 characters"),
  email: z.string().email("Invalid email address format"),
  password: z.string().min(6, "Password must contain at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address format"),
  password: z.string().min(1, "Password is required"),
});

/* ---------------- DEVICE SCHEMAS ---------------- */
export const deviceSchema = z.object({
  name: z.string().min(1, "Device name cannot be blank"),
  type: z.string().min(1, "Device type/category is required"),
  location: z.string().optional(),
});

/* ---------------- TELEMETRY SCHEMAS ---------------- */
export const telemetrySchema = z.object({
  device: objectIdSchema,
  watts: z.number().nonnegative("Power load in Watts must be 0 or higher").optional(),
  kWh: z.number().nonnegative("Consumption in kWh must be 0 or higher"),
  interval: z.enum(["raw", "daily", "weekly", "monthly"]).default("raw"),
});

export const telemetryQuerySchema = z.object({
  interval: z.enum(["raw", "daily", "weekly", "monthly"]).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

/* ---------------- PREDICTION SCHEMAS ---------------- */
export const predictionSchema = z.object({
  timeframe: z.enum(["daily", "weekly", "monthly"]),
  predictedValue: z.number().positive("Predicted energy total must be greater than 0"),
  confidenceScore: z.number().min(0).max(1).optional(),
});

/* ---------------- MACHINE LEARNING WEBHOOK SCHEMA ---------------- */
// Validates incoming anomaly calculations and predictions broadcasted from your Python microservice
export const mlPredictionSchema = z.object({
  userId: objectIdSchema,
  deviceId: objectIdSchema.optional(),
  type: z.enum(["anomaly", "threshold", "info"]),
  isAnomaly: z.boolean(),
  message: z.string().min(1, "Alert insight descriptive statement is required"),
  metrics: z.object({
    currentLoadWatts: z.number().optional(),
    deviationScore: z.number().optional(),
    predictedBillEstimate: z.number().optional(),
  }).optional(),
});
