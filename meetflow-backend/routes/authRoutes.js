import express from 'express';
import { hash, compare, hashSync } from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_SECRET } from '../config/env.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hash factice pour que la durée de réponse ne révèle pas si l'email existe.
const DUMMY_HASH = hashSync('dummy-password-for-timing', 10);

const router = express.Router();

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { lastName, firstName, email, password } = req.body;
    if (!lastName || !firstName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if ([lastName, firstName, email, password].some((v) => typeof v !== 'string')) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Password must be between 8 and 72 characters' });
    }

    const hashedPassword = await hash(password, 10);
    const user = new User({ lastName, firstName, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const user = await User.findOne({ email });
    const passwordOk = await compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !passwordOk) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl || '',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl || '',
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
