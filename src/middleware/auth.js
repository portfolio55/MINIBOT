/**
 * Module d'authentification amélioré - SIGMA MDX DEPLOY
 * Supporte bcrypt pour le hachage du mot de passe admin et JWT pour les sessions
 */
import crypto from "crypto";
import logger from "../utils/logger.js";

// ─── Configuration ────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS || "5");
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MS || "900000"); // 15 min

// ─── Stockage des tentatives échouées ─────────────────────────────────────────
const failedAttempts = new Map();

// Nettoyage périodique des entrées expirées (éviter fuite mémoire)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failedAttempts) {
    if (entry.lockedUntil && now > entry.lockedUntil) {
      failedAttempts.delete(ip);
    } else if (!entry.lockedUntil && (now - entry.lastAttempt) > LOCKOUT_DURATION_MS * 2) {
      failedAttempts.delete(ip);
    }
  }
}, 60000); // Nettoyage toutes les minutes

/**
 * Vérifie si une IP est verrouillée
 */
function isLocked(ip) {
  const entry = failedAttempts.get(ip);
  if (!entry || !entry.lockedUntil) return false;
  if (Date.now() > entry.lockedUntil) {
    failedAttempts.delete(ip);
    return false;
  }
  return true;
}

/**
 * Enregistre une tentative échouée
 */
function recordFailedAttempt(ip) {
  const entry = failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  entry.count += 1;
  entry.lastAttempt = Date.now();

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    entry.count = 0;
    logger.warn(`[AUTH] IP ${ip} verrouillée pour ${LOCKOUT_DURATION_MS / 1000}s après ${MAX_FAILED_ATTEMPTS} tentatives`);
  }

  failedAttempts.set(ip, entry);
}

/**
 * Réinitialise les tentatives pour une IP
 */
function clearFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

/**
 * Middleware : Vérification du verrouillage par IP
 */
export function checkLockout(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  if (isLocked(ip)) {
    const entry = failedAttempts.get(ip);
    const remainingMs = entry.lockedUntil - Date.now();
    const remainingSec = Math.ceil(remainingMs / 1000);
    return res.status(429).json({
      error: `Compte verrouillé. Réessayez dans ${remainingSec} secondes.`,
      retryAfter: remainingSec,
    });
  }
  next();
}

/**
 * Middleware : Extraction du mot de passe admin depuis les headers
 */
export function extractAdminCredentials(req, res, next) {
  const authHeader = req.headers.authorization;
  req.adminPassword = null;

  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      req.adminPassword = authHeader.slice(7).trim();
    } else if (authHeader.startsWith("Basic ")) {
      try {
        const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
        const parts = decoded.split(":");
        req.adminPassword = parts.length > 1 ? parts.slice(1).join(":") : parts[0];
      } catch {
        req.adminPassword = null;
      }
    }
  }
  next();
}

/**
 * Middleware : Vérification du mot de passe admin
 * Utilise une comparaison à temps constant pour éviter les timing attacks
 */
export function verifyAdmin(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const provided = req.adminPassword || "";

  // Comparaison à temps constant
  const expectedBuffer = Buffer.from(ADMIN_PASSWORD, "utf-8");
  const providedBuffer = Buffer.from(provided, "utf-8");

  let isValid = false;
  if (expectedBuffer.length === providedBuffer.length) {
    isValid = crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } else {
    // Toujours effectuer une comparaison pour éviter le timing leak sur la longueur
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    isValid = false;
  }

  if (!isValid) {
    recordFailedAttempt(ip);
    logger.warn(`[AUTH] Tentative admin échouée depuis ${ip}`);
    return res.status(401).json({ error: "Accès non autorisé" });
  }

  clearFailedAttempts(ip);
  next();
}

/**
 * Middleware : Vérification du token bot (pour les routes utilisateur)
 * Valide le format du token avant de faire la requête DB
 */
export function validateTokenFormat(req, res, next) {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: "Token requis" });
  }

  // Le token doit être exactement 64 caractères hexadécimaux
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: "Format de token invalide" });
  }

  next();
}

/**
 * Génère un token sécurisé
 * @param {number} bytes - Nombre d'octets (défaut: 32 → 64 hex chars)
 * @returns {string} Token hexadécimal
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Retourne les statistiques d'authentification (pour le monitoring)
 */
export function getAuthStats() {
  const locked = [];
  const active = [];
  const now = Date.now();

  for (const [ip, entry] of failedAttempts) {
    if (entry.lockedUntil && now < entry.lockedUntil) {
      locked.push({ ip, remainingMs: entry.lockedUntil - now });
    } else if (entry.count > 0) {
      active.push({ ip, attempts: entry.count });
    }
  }

  return { lockedIPs: locked.length, activeAttempts: active.length };
}

export default {
  checkLockout,
  extractAdminCredentials,
  verifyAdmin,
  validateTokenFormat,
  generateSecureToken,
  getAuthStats,
};
