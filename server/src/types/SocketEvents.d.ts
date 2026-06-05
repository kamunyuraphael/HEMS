// Socket event types for real-time communication with clients
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/SocketEvents.d.js";
import logger from './logger.js';

let ioInstance: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

/**
 * Assigns the active global Socket.io instance. Called once inside server.ts.
 */
export const initIO = (io: Server<ClientToServerEvents, ServerToClientEvents>): void => {
  ioInstance = io;
  logger.info(" Socket.io initialization complete inside state manager.");
};

/**
 * Safely fetches the established global Socket.io instance enywhere in the code.
 */
export const getIO = (): Server<ClientToServerEvents, ServerToClientEvents> => {
  if (!ioInstance) {
    throw new Error("Socket.io instance has not been initialized yet. Call initIO(io) first.");
  }
  return ioInstance;
};

export interface AlertEventPayload {
  type: "anomaly" | "threshold" | "info";
  message: string;
  device?: string;
  timestamp: Date;
}

export interface ServerToClientEvents {
  alert: (payload: AlertEventPayload) => void;
}

export interface ClientToServerEvents {
  subscribeAlerts: (userId: string) => void;
  unsubscribeAlerts: (userId: string) => void;
}
