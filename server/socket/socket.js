const { verifyToken } = require('../utils/jwt.utils');
const User = require('../models/User');
const setupUserHandlers = require('./handlers/user.handler');
const setupRoomHandlers = require('./handlers/room.handler');
const setupMessageHandlers = require('./handlers/message.handler');

const onlineUsers = new Map();

const initializeSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username}`);

    onlineUsers.set(socket.user._id.toString(), {
      userId: socket.user._id,
      username: socket.user.username,
      socketId: socket.id
    });

    socket.emit('auth:success', {
      userId: socket.user._id,
      username: socket.user.username
    });

    socket.emit('users:online', {
      users: Array.from(onlineUsers.values()).map(u => ({
        userId: u.userId,
        username: u.username
      }))
    });

    io.emit('user:online', {
      userId: socket.user._id,
      username: socket.user.username,
      isOnline: true
    });

    setupUserHandlers(io, socket, socket.user);
    setupRoomHandlers(io, socket, socket.user);
    setupMessageHandlers(io, socket, socket.user);

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.username}`);
      onlineUsers.delete(socket.user._id.toString());
      
      try {
        await User.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          lastSeen: new Date()
        });
        io.emit('user:offline', {
          userId: socket.user._id,
          username: socket.user.username,
          isOnline: false,
          lastSeen: new Date()
        });
      } catch (error) {
        console.error('Error updating offline status:', error);
      }
    });
  });
};

module.exports = initializeSocket;
