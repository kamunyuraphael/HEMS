// API Routes for HEMS Backend
// Handles all RESTful endpoints for authentication, device management, telemetry data, predictions, and alerts.
import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateBody, validateQuery, validateParams } from "../middleware/validateRequest.js";
import { requireMlApiKey } from "../middleware/apiKeyAuth.js";

// Controllers
import { registerUser, loginUser, getProfile } from "../controllers/authController.js";
import { addDevice, deleteDevice, getDevices } from "../controllers/deviceController.js";
import { getTelemetry, addTelemetry } from "../controllers/telemetryController.js";
import { getPredictions, addPrediction } from "../controllers/predictionController.js";
import { getAlerts } from "../controllers/alertController.js";
import { mlPredictionWebhook } from "../controllers/mlController.js";

// Validation
import {
  registerSchema,
  loginSchema,
  deviceSchema,
  telemetrySchema,
  telemetryQuerySchema,
  predictionSchema,
  mlPredictionSchema,
  idParamSchema,
} from "../validation/schemas.js";

const router = Router();

/* ---------------- AUTH ROUTES ---------------- */
router.post("/auth/register", validateBody(registerSchema), registerUser);
router.post("/auth/login", validateBody(loginSchema), loginUser);
router.get("/auth/profile", authMiddleware, getProfile);

/* ---------------- DEVICE ROUTES ---------------- */
router.post("/devices", authMiddleware, validateBody(deviceSchema), addDevice);
router.delete("/devices/:id", authMiddleware, validateParams(idParamSchema), deleteDevice);
router.get("/devices", authMiddleware, getDevices);

/* ---------------- TELEMETRY ROUTES ---------------- */
router.get("/telemetry", authMiddleware, validateQuery(telemetryQuerySchema), getTelemetry);
router.post("/telemetry", authMiddleware, validateBody(telemetrySchema), addTelemetry);

/* ---------------- PREDICTION ROUTES ---------------- */
router.get("/predictions", authMiddleware, getPredictions);
router.post("/predictions", authMiddleware, validateBody(predictionSchema), addPrediction);

/* ---------------- ML WEBHOOK ---------------- */
router.post(
  "/ml/predictions",
  requireMlApiKey,
  validateBody(mlPredictionSchema),
  mlPredictionWebhook
);

/* ---------------- ALERT ROUTES ---------------- */
router.get("/alerts", authMiddleware, getAlerts);

export default router;
