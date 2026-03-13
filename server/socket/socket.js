const { verifyToken } = require('../utils/jwt.utils');
const User = require('../models/User');
const setupUserHandlers = require('./handlers/user.handler');
const setupRoomHandlers = require('./handlers/room.handler');
const setupMessageHandlers = require('./handlers/message.handler');

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

    socket.emit('auth:success', {
      userId: socket.user._id,
      username: socket.user.username
    });

    setupUserHandlers(io, socket, socket.user);
    setupRoomHandlers(io, socket, socket.user);
    setupMessageHandlers(io, socket, socket.user);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username}`);
    });
  });
};

module.exports = initializeSocket;
