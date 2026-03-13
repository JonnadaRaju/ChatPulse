const Room = require('../../models/Room');
const Message = require('../../models/Message');

const setupRoomHandlers = (io, socket, user) => {
  socket.on('room:join', async ({ roomId }) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      if (!room.members.includes(user._id)) {
        room.members.push(user._id);
        await room.save();
      }

      socket.join(roomId);

      socket.to(roomId).emit('room:user-joined', {
        userId: user._id,
        username: user.username,
        roomId
      });

      const messages = await Message.find({ room: roomId, isDeleted: false })
        .populate('sender', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(50);

      socket.emit('room:messages', {
        roomId,
        messages: messages.reverse()
      });
    } catch (error) {
      socket.emit('room:error', { message: error.message });
    }
  });

  socket.on('room:leave', async ({ roomId }) => {
    try {
      socket.leave(roomId);
      socket.to(roomId).emit('room:user-left', {
        userId: user._id,
        roomId
      });
    } catch (error) {
      socket.emit('room:error', { message: error.message });
    }
  });
};

module.exports = setupRoomHandlers;
