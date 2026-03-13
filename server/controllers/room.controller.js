const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');

const createRoom = async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;

    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(409).json({ message: 'Room name already exists' });
    }

    const room = await Room.create({
      name,
      description,
      isPrivate,
      createdBy: req.user._id,
      members: [req.user._id]
    });

    await room.populate('createdBy', 'username avatar');
    await room.populate('members', 'username avatar isOnline');

    res.status(201).json({
      message: 'Room created',
      room
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create room', error: error.message });
  }
};

const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('createdBy', 'username avatar')
      .populate('members', 'username avatar isOnline')
      .sort({ createdAt: -1 });

    res.status(200).json({
      rooms,
      total: rooms.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get rooms', error: error.message });
  }
};

const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const isMember = room.members.some(m => m.toString() === req.user._id.toString());
    if (!isMember && room.isPrivate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const query = { room: roomId, isDeleted: false };
    const total = await Message.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const messages = await Message.find(query)
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      messages: messages.reverse(),
      page,
      totalPages,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get messages', error: error.message });
  }
};

module.exports = {
  createRoom,
  getRooms,
  getRoomMessages
};
