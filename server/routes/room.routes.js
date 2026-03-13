const express = require('express');
const { body, validationResult } = require('express-validator');
const roomController = require('../controllers/room.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

router.post('/create', [
  body('name').isLength({ min: 1, max: 50 }).withMessage('Room name must be 1-50 characters'),
  body('description').optional().isLength({ max: 200 }),
  body('isPrivate').optional().isBoolean()
], validateRequest, roomController.createRoom);

router.get('/', roomController.getRooms);

router.get('/:roomId/messages', roomController.getRoomMessages);

module.exports = router;
