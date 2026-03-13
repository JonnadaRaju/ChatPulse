# Real-Time Chat Application

## What This Does
ChatPulse is a full-stack real-time chat application built with Socket.IO for WebSocket communication, MongoDB for data persistence, and JWT for secure authentication. Users can create chat rooms, send messages in real-time, see typing indicators, and view online presence status.

## Prerequisites
- Node.js 18+
- MongoDB running locally or MongoDB Atlas URI
- npm or yarn

## Setup
1. Clone the repo
2. npm install
3. cp .env.example .env
4. Fill in MONGO_URI and JWT_SECRET
5. node server/index.js
6. Open client/index.html in browser

## Socket.IO Events Reference

| Event Name | Direction | Payload | Description |
|------------|-----------|---------|-------------|
| user:online | Client→Server | - | Mark user as online |
| user:offline | Server→All | { userId, isOnline, lastSeen } | Broadcast user went offline |
| room:join | Client→Server | { roomId } | Join a chat room |
| room:leave | Client→Server | { roomId } | Leave a chat room |
| room:user-joined | Server→Room | { userId, username, roomId } | Notify room of new user |
| room:user-left | Server→Room | { userId, roomId } | Notify room user left |
| room:messages | Server→Client | { roomId, messages } | Send message history |
| message:send | Client→Server | { roomId, content, type } | Send a message |
| message:receive | Server→Room | { messageId, content, sender, roomId, createdAt, status } | Broadcast message |
| message:typing | Client→Server | { roomId } | User is typing |
| message:stop-typing | Client→Server | { roomId } | User stopped typing |
| message:user-typing | Server→Room | { userId, username, roomId } | Show typing indicator |
| message:user-stop-typing | Server→Room | { userId, roomId } | Hide typing indicator |
| message:seen | Client→Server | { messageId } | Mark message as seen |
| message:status-updated | Server→Room | { messageId, status } | Broadcast status change |
| message:delete | Client→Server | { messageId } | Delete a message |
| message:deleted | Server→Room | { messageId } | Notify message deleted |
| auth:error | Server→Client | { message } | Authentication failed |
| auth:success | Server→Client | { userId, username } | Authentication successful |

## REST API Reference

### Auth Endpoints

#### POST /api/auth/register
- Auth: No
- Request:
```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "secret123"
}
```
- Response (201):
```json
{
  "message": "Registration successful",
  "token": "jwt_token_here",
  "user": { "id", "username", "email", "avatar" }
}
```

#### POST /api/auth/login
- Auth: No
- Request:
```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```
- Response (200):
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": { "id", "username", "email", "avatar" }
}
```

#### GET /api/auth/me
- Auth: Yes (Bearer token)
- Response (200):
```json
{
  "user": { "id", "username", "email", "avatar", "isOnline", "lastSeen" }
}
```

### Room Endpoints

#### POST /api/rooms/create
- Auth: Yes
- Request:
```json
{
  "name": "general",
  "description": "General discussion",
  "isPrivate": false
}
```
- Response (201):
```json
{
  "message": "Room created",
  "room": { "id", "name", "description", "createdBy", "members", "createdAt" }
}
```

#### GET /api/rooms
- Auth: Yes
- Response (200):
```json
{
  "rooms": [ array of room objects ],
  "total": number
}
```

#### GET /api/rooms/:roomId/messages?page=1&limit=50
- Auth: Yes
- Response (200):
```json
{
  "messages": [ array of message objects ],
  "page": 1,
  "totalPages": 5,
  "total": 250
}
```

## Architecture Diagram (Text)

```
Browser (Client)
      │
      ├──────────────────┐
      │                  │
      ▼                  ▼
┌─────────────┐   ┌─────────────┐
│  REST API   │   │ Socket.IO   │
│  /api/auth  │   │  WebSocket  │
│  /api/rooms │   │             │
└──────┬──────┘   └──────┬──────┘
       │                │
       ▼                ▼
   ┌───────┐       ┌───────┐
   │ MongoDB │      │ MongoDB │
   └─────────┘      └─────────┘
```

## Feature List
- [x] Real-time messaging
- [x] Chat rooms
- [x] User authentication
- [x] Online presence
- [x] Typing indicators
- [x] Message history
- [x] Message delete
- [x] Message seen status
- [x] Private rooms
- [x] JWT authentication
- [x] Password hashing

## Troubleshooting

### MongoDB Connection Errors
- Ensure MongoDB is running locally or check your MONGO_URI in .env
- For local: `mongod` or use MongoDB Compass
- For Atlas: Verify your connection string is correct

### JWT Errors
- Ensure JWT_SECRET is set in .env
- Token expires after 7 days (configurable via JWT_EXPIRES_IN)
- Check browser console for "Invalid token" errors

### Socket Connection Failures
- Ensure server is running on port 5000
- Check for CORS errors in browser console
- Verify the socket.io.js script is loaded correctly

### CORS Issues
- Update CLIENT_URL in .env to match your frontend URL
- Default: http://localhost:3000
