# CodeClash 🚀

CodeClash is a high-performance, real-time competitive programming platform designed to host large-scale contests and 1v1 coding battles. Built with a focus on low latency and high concurrency, it features an isolated code execution engine and real-time synchronization across hundreds of users.

## 🛠 Features

- **🏆 Real-time Contests**: Participate in scheduled contests with synchronized start/end times and live global leaderboards.
- **⚔️ 1v1 Arena**: Skill-based matchmaking system powered by Redis to find opponents in seconds.
- **⚙️ Secure Code Execution**: Multi-language support (Python, C++, Java, etc.) using Dockerized Piston for safe and fast grading.
- **🔒 Advanced Authentication**:
  - Google OAuth 2.0 Integration.
  - Email/Password with 6-digit OTP verification.
  - Secure Forgot Password / Reset Password flow.
  - Redis-backed rate limiting on all sensitive auth routes.
- **📡 Real-time Updates**: Live participant tracking, typing indicators, and immediate submission feedback via Socket.io.
- **📊 Performance Optimized**:
  - **Redis Caching**: High-traffic routes (like `join-contest`) are cached in Redis to survive massive launch spikes.
  - **Worker Pattern**: Code execution is handled by separate `code-clash-worker` processes via BullMQ to keep the main API responsive.

## 🏗 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Monaco Editor (CodeMirror alternative), Socket.io-client.
- **Backend**: Node.js (ES Modules), Express, Socket.io.
- **Database**: MongoDB (Mongoose), Redis (ioredis).
- **Task Queue**: BullMQ (handling hundreds of simultaneous grading tasks).
- **Execution Engine**: Piston (running inside isolated Docker containers).
- **Process Management**: PM2 (API + Worker split).

## 📊 Scale & Performance

CodeClash has been battle-tested with a 500-user concurrent load test on an **AWS t3.small** instance:
- **WebSocket Capacity**: Handles 2,000+ simultaneous connections.
- **Grading Throughput**: Successfully evaluated ~90 submissions in 7 seconds across a single 2-core CPU.
- **Bypass Spikes**: Implemented Redis caching for contest metadata to handle 100+ "Join" clicks per second without database exhaustion.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (local or Atlas)
- Redis
- Docker (for Piston code execution)

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rajats496/code-clash.git
   cd code-clash
   ```

2. **Install Dependencies**:
   ```bash
   # Root
   npm install
   # Client
   cd client && npm install
   # Server
   cd ../server && npm install
   ```

3. **Environment Variables**:
   Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_uri
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your_secret
   GOOGLE_CLIENT_ID=your_google_id
   GOOGLE_CLIENT_SECRET=your_google_secret
   EMAIL_USER=your_gmail
   EMAIL_PASS=your_gmail_app_password
   ADMIN_KEY=your_admin_secret
   ```

4. **Run the Project**:
   ```bash
   # Run API (Dev)
   cd server && npm run dev
   # Run Worker
   cd server && npm run worker
   # Run Frontend
   cd client && npm run dev
   ```

## 🌩 Deployment (AWS / PM2)

The project is optimized for deployment on AWS EC2 using PM2 to manage horizontal processes:

```bash
# Start API
pm2 start src/server.js --name code-clash-api
# Start Worker
pm2 start worker.js --name code-clash-worker
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue.

## 📄 License

This project is licensed under the MIT License.
