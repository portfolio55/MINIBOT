/**
 * Routes d'authentification des comptes utilisateurs (abonnés)
 * Connexion via username/password généré au premier pairing du bot.
 */
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { dbGetBotByUsername, dbGetBotAccount } from "../db.js";
import logger from "../utils/logger.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error("[Auth] JWT_SECRET manquant — les sessions utilisateur ne fonctionneront pas correctement");
}

const COOKIE_NAME = "sigma_session";
const SESSION_DURATION = "7d";

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans une minute." },
});

router.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Identifiant et mot de passe requis" });
    }

    const bot = await dbGetBotByUsername(username.trim());
    if (!bot || !bot.passwordHash) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const valid = await bcrypt.compare(password, bot.passwordHash);
    if (!valid) {
      logger.warn(`[Auth] Échec connexion pour username=${username}`);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const token = jwt.sign({ uuid: bot.uuid, username: bot.username }, JWT_SECRET, {
      expiresIn: SESSION_DURATION,
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ ok: true, uuid: bot.uuid });
  } catch (err) {
    logger.error(`[Auth] Erreur login: ${err.message}`);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

/**
 * Middleware: exige une session utilisateur valide (cookie JWT)
 */
export function requireUserAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Non authentifié" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session invalide ou expirée" });
  }
}

router.get("/api/account/me", requireUserAuth, async (req, res) => {
  try {
    const bot = await dbGetBotAccount(req.user.uuid);
    if (!bot) return res.status(404).json({ error: "Compte introuvable" });
    res.json({ ok: true, account: bot });
  } catch (err) {
    logger.error(`[Auth] Erreur /api/account/me: ${err.message}`);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
