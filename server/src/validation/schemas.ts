import { z } from "zod";

// Robust regex pattern ensuring the string represents a valid 24-character hexadecimal MongoDB ObjectId
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, "Must be a valid 24-character hex Mongo ObjectId");

/* ---------------- PARAMETER VALIDATION ---------------- */
export const idParamSchema = z.object({
  id: objectIdSchema,
});

/* ---------------- AUTH SCHEMAS ---------------- */
export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/* ---------------- DEVICE SCHEMAS ---------------- */
export const deviceSchema = z.object({
  name: z.string().min(1, "Device name is required"),
  category: z.enum(["kitchen", "laundry", "lighting", "entertainment", "HVAC", "computing"]),
  status: z.enum(["active", "inactive"]).default("active"),
});

/* ---------------- TELEMETRY SCHEMAS ---------------- */
export const telemetrySchema = z.object({
  device: objectIdSchema,
  watts: z.number().nonnegative("Watts must be a non-negative number"), // 👈 Added to match Mongoose Model requirement
  kWh: z.number().nonnegative("kWh must be a non-negative number"),
  interval: z.enum(["raw", "daily", "weekly", "monthly"]).default("raw"), // 👈 Synchronized with database enums
});

export const telemetryQuerySchema = z.object({
  interval: z.enum(["raw", "daily", "weekly", "monthly"]).optional(),
});

/* ---------------- PREDICTION SCHEMAS ---------------- */
export const predictionSchema = z.object({
  device: objectIdSchema.optional(),
  type: z.enum(["bill", "consumption", "anomaly"]),
  predictedValue: z.number().nonnegative("Predicted value must be a non-negative number"),
  confidence: z.number().min(0, "Confidence must be between 0 and 1").max(1, "Confidence must be between 0 and 1"),
  targetDate: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) {
      return new Date(arg);
    }
    return arg;
  }, z.date({ message: "Target date must be a valid date format" })),
  anomalyDetails: z.string().optional(),
});

// Used when the external ML Microservice sends calculated metrics back to the core API
export const mlPredictionSchema = predictionSchema.extend({
  userId: objectIdSchema,
});