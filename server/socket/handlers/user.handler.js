const User = require('../../models/User');

const setupUserHandlers = (io, socket, user) => {
  socket.on('user:online', async () => {
    try {
      await User.findByIdAndUpdate(user._id, { isOnline: true });
      socket.broadcast.emit('user:online', {
        userId: user._id,
        username: user.username,
        isOnline: true
      });
    } catch (error) {
      console.error('Error marking user online:', error);
    }
  });

  socket.on('disconnect', async () => {
    try {
      await User.findByIdAndUpdate(user._id, {
        isOnline: false,
        lastSeen: new Date()
      });
      socket.broadcast.emit('user:offline', {
        userId: user._id,
        isOnline: false,
        lastSeen: new Date()
      });
    } catch (error) {
      console.error('Error marking user offline:', error);
    }
  });
};

module.exports = setupUserHandlers;
