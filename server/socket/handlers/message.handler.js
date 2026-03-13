const Message = require('../../models/Message');
const Room = require('../../models/Room');

const setupMessageHandlers = (io, socket, user) => {
  socket.on('message:send', async ({ roomId, content, type = 'text' }) => {
    try {
      if (!content || content.trim().length === 0) {
        socket.emit('message:error', { message: 'Message cannot be empty' });
        return;
      }

      if (content.length > 1000) {
        socket.emit('message:error', { message: 'Message too long (max 1000 chars)' });
        return;
      }

      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('message:error', { message: 'Room not found' });
        return;
      }

      const isMember = room.members.some(m => m.toString() === user._id.toString());
      if (!isMember) {
        socket.emit('message:error', { message: 'Not a member of this room' });
        return;
      }

      const message = await Message.create({
        content: content.trim(),
        sender: user._id,
        room: roomId,
        type,
        status: 'sent'
      });

      await message.populate('sender', 'username avatar');

      io.to(roomId).emit('message:receive', {
        messageId: message._id,
        content: message.content,
        sender: {
          id: message.sender._id,
          username: message.sender.username,
          avatar: message.sender.avatar
        },
        roomId,
        type: message.type,
        status: message.status,
        createdAt: message.createdAt
      });
    } catch (error) {
      socket.emit('message:error', { message: error.message });
    }
  });

  socket.on('message:typing', ({ roomId }) => {
    socket.to(roomId).emit('message:user-typing', {
      userId: user._id,
      username: user.username,
      roomId
    });
  });

  socket.on('message:stop-typing', ({ roomId }) => {
    socket.to(roomId).emit('message:user-stop-typing', {
      userId: user._id,
      roomId
    });
  });

  socket.on('message:seen', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      message.status = 'seen';
      await message.save();

      io.to(message.room.toString()).emit('message:status-updated', {
        messageId,
        status: 'seen'
      });
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  });

  socket.on('message:delete', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('message:error', { message: 'Message not found' });
        return;
      }

      if (message.sender.toString() !== user._id.toString()) {
        socket.emit('message:error', { message: 'Cannot delete this message' });
        return;
      }

      message.isDeleted = true;
      await message.save();

      io.to(message.room.toString()).emit('message:deleted', { messageId });
    } catch (error) {
      socket.emit('message:error', { message: error.message });
    }
  });
};

module.exports = setupMessageHandlers;
