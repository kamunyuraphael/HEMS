// validatio/socket.ts
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // React frontend URL 
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Example: User joins a room based on their userId
    socket.on('join', (userId: string) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their notification room.`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected');
    });
  });

  return io;
};