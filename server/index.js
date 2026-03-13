require('dotenv').config();
require('./config/env');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { stopMemoryServer } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const roomRoutes = require('./routes/room.routes');
const initializeSocket = require('./socket/socket');
const env = require('./config/env');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

initializeSocket(io);

const startServer = async () => {
  try {
    await connectDB();
    server.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  await stopMemoryServer();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
