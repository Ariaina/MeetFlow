import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Room from '../models/Room.js';
import { JWT_SECRET } from '../config/env.js';

const MAX_MESSAGE_LENGTH = 5000;

// Salle personnelle d'un utilisateur : permet d'adresser un signal WebRTC
// à un seul destinataire au lieu de le diffuser à toute la salle vidéo.
const userRoom = (userId) => `user:${userId}`;

const leaveVideoRoom = async (io, socket) => {
  const roomId = socket.videoRoomId;
  if (!roomId) return;
  socket.videoRoomId = null;
  socket.leave(roomId);
  socket.to(roomId).emit('user-disconnected', socket.userId);
  try {
    await Room.updateOne({ roomId }, { $pull: { users: socket.userId } });
    const room = await Room.findOne({ roomId });
    if (room && room.users.length === 0) {
      await Room.deleteOne({ roomId });
      console.log(`Salle ${roomId} supprimée car vide`);
    }
  } catch (error) {
    console.error('Erreur en quittant la salle vidéo:', error);
  }
};

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Nouvelle connexion: ${socket.id}`);

    // Tous les événements sauf "authenticate" exigent un socket authentifié.
    socket.use(([event], next) => {
      if (event === 'authenticate' || socket.userId) return next();
      next(new Error('unauthorized'));
    });

    socket.on('error', (err) => {
      if (err && err.message === 'unauthorized') {
        socket.emit('error', { message: 'Non authentifié' });
      }
    });

    socket.on('authenticate', ({ token } = {}) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = String(decoded.id);
        socket.join(userRoom(socket.userId));
        socket.emit('authenticated', { userId: socket.userId });
      } catch {
        socket.emit('error', { message: 'Jeton invalide' });
        socket.disconnect();
      }
    });

    socket.on('join-private-chat', (userId1, userId2) => {
      const ids = [String(userId1), String(userId2)];
      // On ne peut rejoindre que ses propres conversations.
      if (!ids.includes(socket.userId)) {
        console.warn(`join-private-chat refusé pour ${socket.userId}`);
        return;
      }
      socket.join(ids.sort().join('-'));
    });

    socket.on('send-private-message', async (data = {}) => {
      try {
        const { senderId, receiverId, message } = data;
        if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
          return;
        }
        if (String(senderId) !== socket.userId || !mongoose.isValidObjectId(receiverId)) {
          return;
        }
        const chatId = [socket.userId, String(receiverId)].sort().join('-');
        const newMessage = new Message({
          senderId: socket.userId,
          receiverId,
          text: message,
          time: new Date(),
          isRead: false,
        });
        await newMessage.save();
        io.to(chatId).emit('receive-private-message', {
          senderId: socket.userId,
          receiverId: String(receiverId),
          message,
          time: newMessage.time,
          isRead: false,
        });
      } catch (error) {
        console.error('Erreur lors de l’enregistrement du message:', error);
      }
    });

    socket.on('join-video-room', async ({ roomId } = {}) => {
      try {
        if (typeof roomId !== 'string') return;
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Salle non trouvée' });
          return;
        }
        if (socket.videoRoomId && socket.videoRoomId !== roomId) {
          await leaveVideoRoom(io, socket);
        }
        if (!room.users.includes(socket.userId)) {
          room.users.push(socket.userId);
          await room.save();
        }
        socket.videoRoomId = roomId;
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.userId);
        socket.emit('existing-users', room.users.filter((id) => id !== socket.userId));
      } catch (error) {
        console.error('Erreur lors de la jointure de la salle vidéo:', error);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // Enregistré une seule fois par socket (avant : à chaque join-video-room).
    socket.on('signal', async ({ userId, signal } = {}) => {
      const roomId = socket.videoRoomId;
      if (!roomId || !userId || !signal) return;
      const targetId = String(userId);
      // Le destinataire doit être dans la même salle vidéo.
      const room = await Room.findOne({ roomId, users: targetId }).lean();
      if (!room) return;
      io.to(userRoom(targetId)).emit('signal', {
        userId: socket.userId,
        targetUserId: targetId,
        signal,
      });
    });

    socket.on('disconnect', () => {
      leaveVideoRoom(io, socket);
    });
  });
};

export default setupSocket;
