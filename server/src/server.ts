// Bootstraps db connection, attaches Socket.io, listens on the specified port, and logs server status. The main entry point for the HEMS backend server, responsible for initializing the Express application and starting the server.
import express, { type Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

dotenv.config();

// Initialize Database
connectDB();

const app: Application = express();

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json()); // Essential for handling JSON payloads

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log('Server runnning in ${process.env.NODE_ENV} mode on port ${PORT}');
});
