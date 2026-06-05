import express from 'express';
import { createServer } from 'http'; 
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/apiRoutes.js';
import { initSocket } from './socket.js'; 

dotenv.config();

const app = express();
const httpServer = createServer(app); // <-- Create the HTTP server
const io = initSocket(httpServer); // <-- Initialize Socket.io

app.use(cors());
app.use(express.json());

// Make 'io' accessible in the controllers
app.set('socketio', io);

app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI as string).then(() => {
  console.log('💚 Connected to MongoDB.');
  httpServer.listen(PORT, () => { // <-- Listen on the httpServer
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});

export default app;