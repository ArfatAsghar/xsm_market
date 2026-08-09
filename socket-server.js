/**
 * XSM Market - Standalone Socket.IO Real-Time Chat Server
 * Handles real-time messaging, typing indicators, read/delivered receipts, and user presence.
 */

import { Server } from 'socket.io';
import http from 'http';

const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'XSM Market Socket Server Running 🚀' }));
});

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://xsmmarket.com', 'http://xsmmarket.com'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Track online users: userId -> socketId
const activeUsers = new Map();
// Track active chat rooms: socketId -> Set of chatIds
const userChats = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // User auth/presence event
  socket.on('user_connected', (data) => {
    if (data?.userId) {
      activeUsers.set(String(data.userId), socket.id);
      socket.userId = String(data.userId);
      socket.username = data.username || 'User';
      
      // Broadcast online status
      io.emit('presence_update', {
        onlineUserIds: Array.from(activeUsers.keys())
      });
      console.log(`[Socket] User ${data.username} (${data.userId}) marked online`);
    }
  });

  // Join a chat room
  socket.on('join_chat', (chatId) => {
    if (!chatId) return;
    const roomName = `chat_${chatId}`;
    socket.join(roomName);
    
    if (!userChats.has(socket.id)) {
      userChats.set(socket.id, new Set());
    }
    userChats.get(socket.id).add(chatId);
    console.log(`[Socket] ${socket.id} joined room ${roomName}`);
  });

  // Leave a chat room
  socket.on('leave_chat', (chatId) => {
    if (!chatId) return;
    const roomName = `chat_${chatId}`;
    socket.leave(roomName);
    if (userChats.has(socket.id)) {
      userChats.get(socket.id).delete(chatId);
    }
  });

  // Instant message broadcast
  socket.on('send_message', (message) => {
    if (!message || !message.chatId) return;
    const roomName = `chat_${message.chatId}`;
    console.log(`[Socket] Message sent to room ${roomName} from ${message.senderId}`);
    
    // Broadcast to everyone in the room except sender (or to all in room)
    socket.to(roomName).emit('new_message', message);
    
    // Also notify global inbox update for recipient
    socket.broadcast.emit('global_unread_update', {
      chatId: message.chatId,
      senderId: message.senderId
    });
  });

  // Real-time typing indicators
  socket.on('typing', (data) => {
    if (!data?.chatId) return;
    socket.to(`chat_${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId: socket.userId,
      username: data.username || socket.username || 'User'
    });
  });

  socket.on('stop_typing', (data) => {
    if (!data?.chatId) return;
    socket.to(`chat_${data.chatId}`).emit('user_stop_typing', {
      chatId: data.chatId,
      userId: socket.userId
    });
  });

  // Real-time read & delivered receipt events
  socket.on('message_delivered', (data) => {
    if (!data?.chatId || !data?.messageId) return;
    io.to(`chat_${data.chatId}`).emit('message_status_update', {
      messageId: data.messageId,
      chatId: data.chatId,
      status: 'delivered'
    });
  });

  socket.on('messages_read', (data) => {
    if (!data?.chatId) return;
    io.to(`chat_${data.chatId}`).emit('messages_read', {
      chatId: data.chatId,
      userId: socket.userId
    });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      io.emit('presence_update', {
        onlineUserIds: Array.from(activeUsers.keys())
      });
    }
    userChats.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`⚡ XSM Market Socket.IO Server running on port ${PORT}`);
});
