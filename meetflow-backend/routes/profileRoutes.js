import express from 'express';
import jwt from 'jsonwebtoken';
import authenticateToken from '../middleware/auth.js';
import upload from '../middleware/multerConfig.js';
import User from '../models/User.js';
import { JWT_SECRET } from '../config/env.js';

const router = express.Router();

router.put('/update-profile', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;

    if (typeof firstName !== 'string' || typeof lastName !== 'string' || !firstName || !lastName || firstName === 'undefined' || lastName === 'undefined') {
      return res.status(400).json({ error: 'firstName and lastName are required and must not be "undefined"' });
    }

    const update = { firstName, lastName };
    if (req.file) {
      update.photoUrl = `/Uploads/${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = jwt.sign(
      {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        photoUrl: updatedUser.photoUrl,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password, ...safeUser } = updatedUser.toObject();
    res.json({ ...safeUser, token });
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
