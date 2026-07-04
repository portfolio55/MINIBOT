/**
 * Serveur Express principal avec WebSocket
 * SIGMA MDX DEPLOY - Plateforme multi-utilisateurs
 * 
 * [AMÉLIORÉ] Ajout de middlewares de sécurité, validation renforcée,
 * authentification à temps constant, et logging des accès.
 */
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import botManager from "./botManager.js";
import authRouter from "./routes/auth.js";
import paymentRouter from "./routes/payment.js";
import { dbGetExpiredSubscriptions, dbExtendSubscription } from "./db.js";
import config, { SUBSCRIPTION_PLANS } from "./config.js";
import {
  generateUUID,
  createBot,
  getBotByUUID,
  getBotByToken,
  updateBotStatus,
  deleteBot as deleteBotFromStorage,
  listAllBots
} from "./sessionManager.js";
import { isValidPhoneNumber, normalizePhoneNumber } from "./utils/validation.js";
import logger from "./utils/logger.js";
import { applySecurityMiddleware, accessLogger } from "./middleware/security.js";
import { checkLockout, extractAdminCredentials, verifyAdmin, validateTokenFormat, getAuthStats } from "./middleware/auth.js";
import { validatePhoneNumber as validatePhone, isValidUUID } from "./utils/inputSanitizer.js";
import healthRouter from "./routes/health.js";
import { startMemoryGuard } from "./utils/memoryGuard.js";
import { checkDbHealth } from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
// CORS configuré via variable d'environnement (défaut: permissif pour dev, restreindre en prod)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
  : ["*"];

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  // Limiter la taille des paquets WebSocket
  maxHttpBufferSize: 1e6, // 1MB max
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PUBLIC_URL = process.env.PUBLIC_URL;
const DOMAIN = process.env.DOMAIN;

const normalizePublicUrl = (value) => {
  if (!value) return null;
  const v = String(value).trim().replace(/\/+$/, "");
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
};

const pairingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessayez dans une minute." }
});

// [AMÉLIORÉ] Authentification admin déléguée au module middleware/auth.js
// (comparaison à temps constant, lockout automatique, nettoyage mémoire)
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  handler: (req, res) => {
    res.status(429).json({ error: "Trop de requêtes admin. Réessayez plus tard." });
  }
});

const botApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessayez dans une minute." }
});

// ─── Middlewares de sécurité ──────────────────────────────────────────────────
applySecurityMiddleware(app, {
  allowedOrigins: ALLOWED_ORIGINS,
  trustProxy: !!process.env.TRUST_PROXY,
});

// Middleware de base
app.use(express.json({ limit: "1mb" })); // Limiter la taille du body
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(accessLogger);
app.use(express.static(path.join(__dirname, "..", "public"), {
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      // Les pages HTML ne doivent jamais être mises en cache pour éviter
      // de servir une version obsolète après une mise à jour du design.
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  },
}));

// ─── Comptes utilisateurs / abonnements ──────────────────────────────────
app.use(authRouter);
app.use(paymentRouter);

// [ABONNEMENTS] Déconnexion automatique des bots dont l'abonnement a expiré
const subscriptionCheckInterval = setInterval(async () => {
  try {
    const expired = await dbGetExpiredSubscriptions();
    for (const bot of expired) {
      if (bot.status === "connected" || bot.status === "connecting") {
        logger.info(`[Abonnement] Bot ${bot.uuid} expiré — arrêt automatique`);
        try {
          await botManager.stopBot(bot.uuid);
        } catch (e) {
          logger.warn(`[Abonnement] Erreur arrêt bot ${bot.uuid}: ${e.message}`);
        }
      }
      await updateBotStatus(bot.uuid, "expired");
    }
    if (expired.length > 0) {
      logger.info(`[Abonnement] ${expired.length} bot(s) désactivé(s) pour abonnement expiré`);
    }
  } catch (err) {
    logger.error(`[Abonnement] Erreur vérification expirations: ${err.message}`);
  }
}, config.subscription.checkIntervalMs);
subscriptionCheckInterval.unref();

// Écouter les événements du BotManager
botManager.on("pairing-code", ({ uuid, pairingCode }) => {
  io.to(`pairing:${uuid}`).emit("pairing-code", { uuid, pairingCode });
});

botManager.on("pairing-error", ({ uuid, error }) => {
  io.to(`pairing:${uuid}`).emit("pairing-error", { uuid, error });
});

botManager.on("bot-connected", ({ uuid }) => {
  io.to(`pairing:${uuid}`).emit("pairing-success", { uuid });
  io.to(`bot:${uuid}`).emit("bot-status", { uuid, status: "connected" });
});

botManager.on("bot-disconnected", ({ uuid, reason }) => {
  io.to(`bot:${uuid}`).emit("bot-status", { uuid, status: "disconnected", reason });
});

botManager.on("bot-error", ({ uuid, error }) => {
  io.to(`pairing:${uuid}`).emit("pairing-error", { uuid, error });
  io.to(`bot:${uuid}`).emit("bot-error", { uuid, error });
});

// Routes API

// Page d'accueil (appairage)
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "..", "public", "index.html");
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(200).send("SIGMA MDX DEPLOY - OK");
  }
});

// [AMÉLIORÉ] Healthcheck complet avec vérification DB, mémoire, et métriques
app.use(healthRouter);

// Démarrer la surveillance mémoire
startMemoryGuard();

// [KEEPALIVE DB] Ping périodique pour empêcher Neon de se mettre en veille
// (autosuspend par défaut après quelques minutes d'inactivité sur les plans serverless)
const DB_KEEPALIVE_INTERVAL_MS = parseInt(process.env.DB_KEEPALIVE_INTERVAL_MS || "180000");
const dbKeepaliveInterval = setInterval(async () => {
  try {
    const result = await checkDbHealth();
    if (!result.ok) {
      logger.warn(`[DB Keepalive] Échec du ping: ${result.error}`);
    }
  } catch (err) {
    logger.warn(`[DB Keepalive] Erreur: ${err.message}`);
  }
}, DB_KEEPALIVE_INTERVAL_MS);
dbKeepaliveInterval.unref();
logger.info(`[DB Keepalive] Ping démarré toutes les ${DB_KEEPALIVE_INTERVAL_MS / 1000}s (anti scale-to-zero Neon)`);

// Démarrer le processus d'appairage
app.post("/api/pairing/start", pairingLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Numéro WhatsApp requis" });
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: "Numéro WhatsApp invalide" });
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber);

    // Vérifier la limite maximale de bots
    const allBots = await listAllBots();
    const maxBots = parseInt(process.env.MAX_BOTS || "100");
    const activeBots = allBots.filter(b => b.status === "connected" || b.status === "connecting");
    if (activeBots.length >= maxBots) {
      return res.status(429).json({
        error: `Limite atteinte : ${maxBots} bots maximum. Contactez l'administrateur.`
      });
    }

    // Vérifier si un bot existe déjà pour ce numéro
    const existingBot = allBots.find(bot => bot.phoneNumber === normalizedNumber);

    if (existingBot) {
      if (existingBot.status === "connected") {
        return res.status(400).json({
          error: "Un bot est déjà connecté pour ce numéro",
          token: existingBot.token
        });
      }

      // Si le bot est en cours de pairing ou connecting, le stopper d'abord
      if (["pairing", "connecting", "conflict"].includes(existingBot.status)) {
        try {
          await botManager.stopBot(existingBot.uuid);
        } catch {}
      }

      // Supprimer l'ancienne entrée (logged_out, stopped, error, conflict, disconnected)
      try {
        await botManager.deleteBot(existingBot.uuid);
      } catch {}
      try {
        await deleteBotFromStorage(existingBot.uuid);
      } catch {}
    }

    // Générer un UUID unique
    const uuid = generateUUID();

    // Créer le bot dans le registre
    const token = await createBot(uuid, normalizedNumber);

    // Créer l'instance dans le BotManager
    await botManager.createBot(uuid, normalizedNumber);

    // [AMÉLIORÉ] Démarrer le bot avec retry automatique sur "Connection Closed"
    const MAX_PAIRING_RETRIES = 2;
    let pairingCode = null;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_PAIRING_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`[Pairing] Retry ${attempt}/${MAX_PAIRING_RETRIES} pour ${uuid}...`);
          // Nettoyer avant retry
          try { await botManager.stopBot(uuid); } catch {}
          await new Promise(r => setTimeout(r, 2000 + attempt * 1000));
        }
        pairingCode = await botManager.startBot(uuid);
        lastError = null;
        break; // Succès, sortir de la boucle
      } catch (err) {
        lastError = err;
        const isRetryable = /Connection Closed|ETIMEDOUT|ECONNRESET|socket hang up|timeout/i.test(err.message);
        if (!isRetryable || attempt >= MAX_PAIRING_RETRIES) {
          break; // Erreur non récupérable ou max retries atteint
        }
        logger.warn(`[Pairing] Erreur récupérable (attempt ${attempt + 1}): ${err.message}`);
      }
    }

    if (lastError && !pairingCode) {
      throw lastError;
    }

    res.json({
      success: true,
      uuid,
      token,
      pairingCode,
      message: "Processus d'appairage démarré"
    });
  } catch (error) {
    logger.error(`Erreur démarrage appairage: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Statut d'appairage
app.get("/api/pairing/status/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const bot = await getBotByUUID(uuid);
    
    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    const botStatus = botManager.getBotStatus(uuid);
    
    res.json({
      uuid,
      status: bot?.status || botStatus?.status || "unknown",
      phoneNumber: bot.phoneNumber
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard utilisateur
app.get("/dashboard/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

// API Bot - Démarrer
// [AMÉLIORÉ] Validation du format de token avant requête DB
app.post("/api/bot/:token/start", botApiLimiter, validateTokenFormat, async (req, res) => {
  try {
    const { token } = req.params;
    const bot = await getBotByToken(token);

    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    await botManager.startBot(bot.uuid);
    res.json({ success: true, message: "Bot démarré" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Bot - Arrêter
app.post("/api/bot/:token/stop", botApiLimiter, validateTokenFormat, async (req, res) => {
  try {
    const { token } = req.params;
    const bot = await getBotByToken(token);

    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    await botManager.stopBot(bot.uuid);
    res.json({ success: true, message: "Bot arrêté" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Bot - Redémarrer
app.post("/api/bot/:token/restart", botApiLimiter, validateTokenFormat, async (req, res) => {
  try {
    const { token } = req.params;
    const bot = await getBotByToken(token);

    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    await botManager.restartBot(bot.uuid);
    res.json({ success: true, message: "Bot redémarré" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Bot - Supprimer (tout ce qui est lié à ce numéro : session, stockage, instance)
app.delete("/api/bot/:token", botApiLimiter, validateTokenFormat, async (req, res) => {
  try {
    const { token } = req.params;
    const bot = await getBotByToken(token);

    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    const uuid = bot.uuid;
    const sessionPath = path.join(__dirname, "..", bot.sessionPath || `sessions/bot_${uuid}`);

    try {
      await botManager.deleteBot(uuid);
    } catch (e) {
      logger.warn(`deleteBot(${uuid}): ${e.message}`);
      try {
        const { deleteAuthState } = await import("./usePostgresAuthState.js");
        await deleteAuthState(uuid);
        await fs.remove(sessionPath).catch(() => {});
        logger.info(`Session nettoyée pour ${uuid}`);
      } catch (rmErr) {
        logger.warn(`Suppression session: ${rmErr.message}`);
      }
    }

    await deleteBotFromStorage(uuid);
    res.json({ success: true, message: "Bot et toutes les données liées à ce numéro ont été supprimés." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Bot - Statut
app.get("/api/bot/:token/status", botApiLimiter, validateTokenFormat, async (req, res) => {
  try {
    const { token } = req.params;
    const bot = await getBotByToken(token);

    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    const botStatus = botManager.getBotStatus(bot.uuid);
    res.json({
      ...bot,
      socketStatus: botStatus?.status || "unknown"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Admin
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
});

// API Admin - Liste tous les bots
// [AMÉLIORÉ] Utilisation de l'auth à temps constant + lockout amélioré
app.get("/api/admin/bots", adminLimiter, checkLockout, extractAdminCredentials, verifyAdmin, async (req, res) => {
  try {
    const bots = await listAllBots();
    const botsWithStatus = bots.map(bot => {
      const status = botManager.getBotStatus(bot.uuid);
      return {
        ...bot,
        socketStatus: status?.status || "unknown"
      };
    });

    const maxBots = parseInt(process.env.MAX_BOTS || "100");
    const activeBots = botsWithStatus.filter(b => b.socketStatus === "connected" || b.socketStatus === "connecting").length;

    res.json({
      bots: botsWithStatus,
      capacity: {
        total: bots.length,
        active: activeBots,
        max: maxBots,
        available: Math.max(0, maxBots - activeBots)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Admin - Statistiques de sécurité (monitoring)
app.get("/api/admin/security", adminLimiter, checkLockout, extractAdminCredentials, verifyAdmin, (req, res) => {
  res.json({
    auth: getAuthStats(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API Admin - Actions sur un bot
// [AMÉLIORÉ] Validation UUID + auth renforcée
app.post("/api/admin/bot/:uuid/:action", adminLimiter, checkLockout, extractAdminCredentials, verifyAdmin, async (req, res) => {
  try {
    const { uuid, action } = req.params;

    const bot = await getBotByUUID(uuid);
    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    switch (action) {
      case "start":
        await botManager.startBot(uuid);
        break;
      case "stop":
        await botManager.stopBot(uuid);
        break;
      case "restart":
        await botManager.restartBot(uuid);
        break;
      case "delete":
        await botManager.deleteBot(uuid);
        await deleteBotFromStorage(uuid);
        break;
      default:
        return res.status(400).json({ error: "Action invalide" });
    }

    res.json({ success: true, message: `Action ${action} exécutée` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Admin - Prolonger manuellement l'abonnement d'un bot
app.post("/api/admin/bot/:uuid/extend-subscription", adminLimiter, checkLockout, extractAdminCredentials, verifyAdmin, async (req, res) => {
  try {
    const { uuid } = req.params;
    const { plan } = req.body;
    const planDef = SUBSCRIPTION_PLANS[plan];
    if (!planDef) {
      return res.status(400).json({ error: "Plan invalide" });
    }

    const bot = await getBotByUUID(uuid);
    if (!bot) {
      return res.status(404).json({ error: "Bot introuvable" });
    }

    const result = await dbExtendSubscription(uuid, plan, planDef.durationMs);
    logger.info(`[Admin] Abonnement ${plan} accordé manuellement au bot ${uuid}`);
    res.json({ success: true, subscriptionExpiresAt: result?.subscriptionExpiresAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((err, req, res, next) => {
  logger.error(`Express error on ${req.method} ${req.path}: ${err.message}`);
  logger.error(err.stack);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

// WebSocket - Gestion des connexions
io.on("connection", (socket) => {
  logger.info(`Client WebSocket connecté: ${socket.id}`);

  // Rejoindre une room pour le pairing
  socket.on("join-pairing", ({ uuid }) => {
    socket.join(`pairing:${uuid}`);
    logger.info(`Client ${socket.id} rejoint pairing:${uuid}`);
  });

  // Rejoindre une room pour un bot
  socket.on("join-bot", ({ uuid }) => {
    socket.join(`bot:${uuid}`);
    logger.info(`Client ${socket.id} rejoint bot:${uuid}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Client WebSocket déconnecté: ${socket.id}`);
  });
});

// Route de fallback pour les tokens sans /dashboard/ (redirection automatique)
// DOIT être placée en dernier pour ne pas capturer les autres routes
app.get("/:token", async (req, res) => {
  const { token } = req.params;
  
  // Ignorer les routes connues
  if (['admin', 'api', 'dashboard', 'favicon.ico'].includes(token)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Page introuvable</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #333; }
          p { color: #666; }
          a { color: #667eea; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>404 - Page introuvable</h1>
        <p>La page demandée n'existe pas.</p>
        <p><a href="/">Retour à l'accueil</a></p>
      </body>
      </html>
    `);
  }
  
  // Vérifier si c'est un token valide (64 caractères hexadécimaux)
  if (token && token.length === 64 && /^[a-f0-9]+$/i.test(token)) {
    // Vérifier si le token existe dans le système
    try {
      const bot = await getBotByToken(token);
      if (bot) {
        // Rediriger vers le dashboard avec le bon format
        return res.redirect(`/dashboard/${token}`);
      }
    } catch (error) {
      // Token invalide, continuer vers 404
    }
  }
  
  // Si ce n'est pas un token valide, retourner 404
  const baseUrl = PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Page introuvable</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
        p { color: #666; }
        a { color: #667eea; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404 - Page introuvable</h1>
      <p>La page demandée n'existe pas.</p>
      <p><a href="/">Retour à l'accueil</a></p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        Si vous essayez d'accéder à votre dashboard, utilisez :<br>
        <code>/dashboard/VOTRE_TOKEN</code><br><br>
        Ou accédez directement avec : <code>${baseUrl}/VOTRE_TOKEN</code>
      </p>
    </body>
    </html>
  `);
});

// Démarrer le serveur
httpServer.listen(PORT, HOST, async () => {
  const displayUrl =
    normalizePublicUrl(PUBLIC_URL) ||
    normalizePublicUrl(DOMAIN) ||
    `http://${HOST}:${PORT}`;

  logger.info(`╔══════════════════════════════════════╗`);
  logger.info(`║   SIGMA MDX DEPLOY - SERVEUR ACTIF   ║`);
  logger.info(`╠══════════════════════════════════════╣`);
  logger.info(`║  Port: ${PORT.toString().padEnd(28)}║`);
  logger.info(`║  URL: ${displayUrl.padEnd(32)}║`);
  logger.info(`╚══════════════════════════════════════╝`);
  
  // Reconnexion automatique des bots existants
  await reconnectExistingBots();

  // Démarrer les tâches de surveillance h24
  botManager.startBackgroundTasks();
});

// Fonction pour reconnecter automatiquement les bots existants
async function reconnectExistingBots() {
  try {
    logger.info("🔄 Reconnexion automatique des bots existants...");
    const bots = await listAllBots();
    
    if (bots.length === 0) {
      logger.info("✅ Aucun bot à reconnecter");
      return;
    }
    
    // Filtrer les bots logged_out (besoin re-pair manuel) et les bots sans session
    const reconnectableBots = [];
    for (const bot of bots) {
      if (bot.status === "logged_out") {
        logger.info(`⏭️ Skip bot ${bot.uuid} (logged_out — re-pair nécessaire)`);
        continue;
      }
      if (bot.status === "waiting_recovery") {
        logger.info(`⏭️ Skip bot ${bot.uuid} (waiting_recovery — recovery sweep le reprendra)`);
        continue;
      }
      const { hasAuthState } = await import("./usePostgresAuthState.js");
      const hasSession = await hasAuthState(bot.uuid);
      if (!hasSession) {
        logger.info(`⏭️ Skip bot ${bot.uuid} (pas de session DB — re-pair nécessaire)`);
        continue;
      }
      reconnectableBots.push(bot);
    }

    if (reconnectableBots.length === 0) {
      logger.info("✅ Aucun bot reconnectable");
      return;
    }

    logger.info(`📋 ${reconnectableBots.length} bot(s) à reconnecter (${bots.length - reconnectableBots.length} skippé(s))`);

    // [300 BOTS] Augmenter la concurrence par défaut à 15 pour un démarrage plus rapide
    const concurrency = Math.max(1, parseInt(process.env.BOT_RECONNECT_CONCURRENCY || "15"));
    // [300 BOTS] Réduire le délai entre les lancements à 100ms
    const delayMs = Math.max(0, parseInt(process.env.BOT_RECONNECT_DELAY_MS || "100"));

    let idx = 0;
    const worker = async () => {
      while (idx < reconnectableBots.length) {
        const bot = reconnectableBots[idx++];
        try {
          logger.info(`🔄 Reconnexion du bot ${bot.uuid} (${bot.phoneNumber})...`);

          await botManager.createBot(bot.uuid, bot.phoneNumber, false);
          await botManager.startBot(bot.uuid);

          logger.info(`✅ Bot ${bot.uuid} reconnecté avec succès`);
        } catch (error) {
          logger.error(`❌ Erreur reconnexion bot ${bot.uuid}: ${error.message}`);
          await updateBotStatus(bot.uuid, "error");
        }

        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, reconnectableBots.length) }, () => worker());
    await Promise.all(workers);
    
    logger.info("🎉 Reconnexion automatique terminée");
    
  } catch (error) {
    logger.error("❌ Erreur lors de la reconnexion automatique:", error);
  }
}

// Graceful shutdown — fermer proprement toutes les connexions
async function gracefulShutdown(signal) {
  logger.info(`⚡ ${signal} reçu — fermeture propre en cours...`);
  botManager.stopBackgroundTasks();

  const stopPromises = [];
  for (const [uuid] of botManager.bots) {
    stopPromises.push(
      botManager.stopBot(uuid).catch(e => {
        logger.debug(`Shutdown stop ${uuid}: ${e.message}`);
      })
    );
  }
  await Promise.allSettled(stopPromises);

  logger.info("✅ Tous les bots arrêtés proprement");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Gestion des erreurs — ne pas crash le process
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  logger.error(error.stack);
});
