import express from 'express';
import { randomUUID } from 'crypto';
import authenticateToken from '../middleware/auth.js';
import Room from '../models/Room.js';

const router = express.Router();

router.post('/create-room', authenticateToken, async (req, res) => {
  try {
    const roomId = randomUUID();
    const room = new Room({
      roomId,
      creator: req.user.id,
      users: [req.user.id],
      createdAt: new Date(),
    });
    await room.save();
    res.status(201).json({ roomId });
  } catch (err) {
    console.error('create-room:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/join-room', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    if (typeof roomId !== 'string') {
      return res.status(400).json({ error: 'roomId invalide' });
    }
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }
    if (!room.users.includes(req.user.id)) {
      room.users.push(req.user.id);
      await room.save();
    }
    res.status(200).json({ message: 'Salle rejointe', roomId });
  } catch (err) {
    console.error('join-room:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Authentifiée, et ne renvoie plus la liste des participants.
router.get('/check-room/:roomId', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: String(req.params.roomId) });
    if (!room) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }
    res.status(200).json({ roomId: room.roomId });
  } catch (err) {
    console.error('check-room:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
