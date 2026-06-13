import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import logger from "./utils/logger.js";
import { initIO } from "./utils/socketEvents.js";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/SocketEvents.js";

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || '*',
    methods: ['GET', 'POST'],
  },
});

initIO(io);

io.on('connection', (socket) => {
  logger.info(`🔌 Connection handshake opened: ${socket.id}`);

  // Dynamic Room Subscription matching the User ID
  socket.on("subscribeAlerts", (userId: string) => {
    socket.join(userId);
    logger.info(`👥 Client ${socket.id} joined alerts pipeline channel: [User: ${userId}]`);
  });

  socket.on("unsubscribeAlerts", (userId: string) => {
    socket.leave(userId);
    logger.info(`👥 Client ${socket.id} disconnected from channel: [User: ${userId}]`);
  });

  socket.on("disconnect", () => {
    logger.info(`❌ Connection handshake severed: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  logger.info(`🚀 HEMS Engine orchestrating safely on port ${PORT}`);
});