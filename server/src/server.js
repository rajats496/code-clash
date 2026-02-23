import dotenv from 'dotenv';

// ⚠️ CRITICAL: Load .env BEFORE any other imports
dotenv.config();

// Now import everything else
import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { initializeSocket } from './socket/index.js';

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.io ready for connections`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  });