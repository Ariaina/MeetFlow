import rateLimit from 'express-rate-limit';

const message = (text) => ({ error: text });

// Connexion : 10 échecs par IP sur 15 min. Les connexions réussies ne comptent pas,
// donc un utilisateur légitime n'est pas bloqué.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Trop de tentatives de connexion. Réessayez dans 15 minutes.'),
});

// Inscription : 5 comptes par IP et par heure.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message("Trop d'inscriptions depuis cette adresse. Réessayez plus tard."),
});

// Garde-fou global sur l'API : 300 requêtes par IP par minute.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Trop de requêtes. Ralentissez.'),
});
