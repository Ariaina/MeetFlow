import dotenv from 'dotenv';

dotenv.config();

const required = ['JWT_SECRET', 'MONGO_URI'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Variables d'environnement manquantes : ${missing.join(', ')}. Voir .env.example`);
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET doit contenir au moins 32 caractères.');
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const MONGO_URI = process.env.MONGO_URI;
export const PORT = process.env.PORT || 3000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:4200';
