/**
 * Middleware de sécurité centralisé - SIGMA MDX DEPLOY
 * Ajoute helmet, compression, HPP, CORS strict, et logging de sécurité
 */
import helmet from "helmet";
import compression from "compression";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import logger from "../utils/logger.js";

/**
 * Configure tous les middlewares de sécurité sur l'app Express
 * @param {import('express').Application} app
 * @param {object} options
 */
export function applySecurityMiddleware(app, options = {}) {
  const {
    allowedOrigins = [],
    trustProxy = false,
  } = options;

  // Trust proxy si derrière un reverse proxy (Render, Railway, etc.)
  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  // Helmet — en-têtes de sécurité HTTP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // Compression gzip/brotli pour les réponses
  app.use(compression({
    threshold: 1024, // Ne compresser que les réponses > 1KB
    level: 6,
  }));

  // Protection contre la pollution de paramètres HTTP
  app.use(hpp());

  // Logging des requêtes suspectes
  app.use((req, res, next) => {
    // Détecter les tentatives d'injection dans les headers
    const suspiciousHeaders = ["x-forwarded-host", "x-original-url", "x-rewrite-url"];
    for (const header of suspiciousHeaders) {
      if (req.headers[header] && !trustProxy) {
        logger.warn(`[SECURITY] Header suspect détecté: ${header}=${req.headers[header]} de ${req.ip}`);
      }
    }
    next();
  });

  // Rate limiter global (protection DDoS basique)
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limite par IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de requêtes depuis cette IP. Réessayez plus tard." },
    skip: (req) => req.path === "/health", // Ne pas limiter le healthcheck
  });
  app.use(globalLimiter);

  logger.info("🛡️ Middlewares de sécurité appliqués (helmet, compression, hpp, rate-limit)");
}

/**
 * Middleware de validation du Content-Type pour les routes POST/PUT
 */
export function validateContentType(req, res, next) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("application/json")) {
      // Autoriser les requêtes sans body (certains POST n'ont pas de body)
      if (req.headers["content-length"] && parseInt(req.headers["content-length"]) > 0) {
        return res.status(415).json({ error: "Content-Type application/json requis" });
      }
    }
  }
  next();
}

/**
 * Middleware de logging des accès (format compact)
 */
export function accessLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    // Ne logger que les erreurs et les requêtes lentes
    if (status >= 400 || duration > 2000) {
      logger.warn(`[HTTP] ${req.method} ${req.path} → ${status} (${duration}ms) IP:${req.ip}`);
    }
  });
  next();
}

export default { applySecurityMiddleware, validateContentType, accessLogger };
