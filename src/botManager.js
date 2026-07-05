/**
 * BotManager - Gestionnaire central des instances Baileys
 * Gère la création, démarrage, arrêt et suppression de bots isolés
 */
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { pathToFileURL, fileURLToPath } from "url";
import pino from "pino";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "events";
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import logger from "./utils/logger.js";
import { getBotMode, getReactionEmoji } from "./utils/botMode.js";
import { updateBotStatus, getBotByUUID } from "./sessionManager.js";
import { initProtections } from "../protections.js";
import { initProtections as initProtections2 } from "../protections2.js";
import { createGroupManager } from "../groupManager.js";
import { usePostgresAuthState, deleteAuthState, hasAuthState } from "./usePostgresAuthState.js";
import { dbGetBotAccount, dbSetBotAccount } from "./db.js";
import { generateCredentials } from "./services/moneyfusion.js";
import { SUBSCRIPTION_PLANS } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration globale du bot
const BOT_CONFIG = {
  PREFIXE_COMMANDE: process.env.PREFIXE || "!",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY) || 5000,
  KEEPALIVE_INTERVAL_MS: parseInt(process.env.KEEPALIVE_INTERVAL_MS || "20000"),
  MAX_RECONNECT_ATTEMPTS: Infinity, // [24/7] Pas de limite — reconnexion infinie sauf arrêt manuel
  HEALTH_CHECK_INTERVAL_MS: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || "60000"),
  RECOVERY_SWEEP_INTERVAL_MS: parseInt(process.env.RECOVERY_SWEEP_INTERVAL_MS || "120000"),
};

const CONFIG_CACHE_TTL_MS = Math.max(0, parseInt(process.env.CONFIG_CACHE_TTL_MS || "10000"));
const jsonCache = new Map();

const readJsonCached = async (filePath, fallback) => {
  if (!filePath) return fallback;
  if (CONFIG_CACHE_TTL_MS === 0) {
    try {
      return await fs.readJSON(filePath);
    } catch {
      return fallback;
    }
  }

  const now = Date.now();
  const cached = jsonCache.get(filePath);
  if (cached && (now - cached.ts) < CONFIG_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const value = await fs.readJSON(filePath);
    jsonCache.set(filePath, { value, ts: now });
    return value;
  } catch {
    jsonCache.set(filePath, { value: fallback, ts: now });
    return fallback;
  }
};

// Fichiers de configuration par bot (isolés dans le dossier de session)
const getBotConfigPath = (sessionPath, filename) => {
  return path.join(sessionPath, filename);
};

// Utilitaires (copiés depuis index.js)
const normalizeJid = (jid) => {
  if (!jid) return null;
  const base = String(jid).trim().split(":")[0];
  return base.includes("@") ? base : `${base}@s.whatsapp.net`;
};

const getBareNumber = (input) => {
  if (!input) return "";
  return String(input).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
};

const unwrapMessage = (m) => {
  return m?.ephemeralMessage?.message ||
         m?.viewOnceMessageV2?.message ||
         m?.viewOnceMessageV2Extension?.message ||
         m?.documentWithCaptionMessage?.message ||
         m?.viewOnceMessage?.message ||
         m;
};

const pickText = (m) => {
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    m.reactionMessage?.text ||
    (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
      ? JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson || "{}")?.text || ""
      : "")
  );
};

// Charger les commandes (une seule fois, partagées entre toutes les instances)
let globalCommands = null;

async function loadCommands() {
  if (globalCommands) return globalCommands;
  
  globalCommands = {};
  let loadedFromDir = 0;
  let loadedFromBug = 0;

  // Import des commandes bug avec gestion d'erreur
  let bugCommands = [];
  try {
    const bugModule = await import("../bug.js");
    bugCommands = bugModule.default || [];
    logger.info(`✅ ${bugCommands.length} commandes bug importées`);
  } catch (err) {
    logger.error(`❌ Erreur import bug.js: ${err.message}`);
    bugCommands = [];
  }

  const cmdDir = path.join(__dirname, "..", "commands");
  if (await fs.pathExists(cmdDir)) {
    const files = (await fs.readdir(cmdDir)).filter(f => f.endsWith(".js"));
    for (const file of files) {
      try {
        const cmdPath = path.resolve(cmdDir, file);
        const cmd = await import(pathToFileURL(cmdPath).href);
        // IMPORTANT: ESM module namespace objects are immutable/non-extensible.
        // Some commands export named exports (export const name / export async function execute)
        // so we normalize into a plain extensible object.
        const raw = cmd?.default ?? cmd;
        const command = (raw && typeof raw === "object" && !Object.isExtensible(raw)) ? { ...raw } : raw;

        if (command?.name && typeof command.execute === "function") {
          const nameKey = String(command.name).toLowerCase();
          if (globalCommands[nameKey]) {
            const prev = globalCommands[nameKey];
            const prevSrc = prev?.__source || "unknown";
            logger.warn(`⚠️ Doublon commande: ${nameKey} (${prevSrc}) ← remplacée par commands/${file}`);
          }
          command.__source = `commands/${file}`;
          globalCommands[nameKey] = command;
          loadedFromDir++;
          logger.debug(`✅ Commande chargée: ${command.name} depuis ${file}`);
        }
      } catch (err) {
        logger.error(`❌ Erreur chargement commande ${file}: ${err.message}`);
      }
    }
  }

  // Charger les commandes depuis bug.js
  try {
    for (const cmd of bugCommands) {
      if (cmd?.name && typeof cmd.execute === "function") {
        const name = cmd.name.toLowerCase();
        if (globalCommands[name]) {
          const prev = globalCommands[name];
          const prevSrc = prev?.__source || "unknown";
          logger.warn(`⚠️ Doublon commande: ${name} (${prevSrc}) ← bug.js ignoré`);
          continue;
        }
        cmd.__source = "bug.js";
        globalCommands[name] = cmd;
        loadedFromBug++;
        logger.debug(`✅ Commande bug chargée: ${cmd.name}`);
      }
    }
  } catch (err) {
    logger.error(`❌ Erreur chargement bug.js: ${err.message}`);
  }

  logger.info(`📋 Commands loaded: ${loadedFromDir} (dir) + ${loadedFromBug} (bug.js) = ${Object.keys(globalCommands).length}`);
  logger.debug(`📋 Commandes disponibles: [${Object.keys(globalCommands).join(', ')}]`);
  return globalCommands;
}

// [OPTIMISÉ] Cache des chemins de config par session (évite les vérifications fs à chaque message)
const _configInitialized = new Set();

// Charger les fichiers de configuration pour un bot spécifique
async function loadBotConfig(sessionPath) {
  const CONFIG_PATH = getBotConfigPath(sessionPath, "config.json");
  const MODE_PREFIX_FILE = getBotConfigPath(sessionPath, "modeprefix.json");
  const PREFIX_FILE = getBotConfigPath(sessionPath, "prefix.json");
  const BRANDING_FILE = getBotConfigPath(sessionPath, "branding.json");
  const GROUP_CONFIG_PATH = getBotConfigPath(sessionPath, "group.json");
  const JID_FILE = getBotConfigPath(sessionPath, "jid.json");
  const RESPONS_FILE = getBotConfigPath(sessionPath, "respons.json");
  const SUDO_FILE = getBotConfigPath(sessionPath, "sudo.json");
  const MODE_FILE = getBotConfigPath(sessionPath, "mode.json");

  // [OPTIMISÉ] Initialiser les fichiers UNE SEULE FOIS par session (pas à chaque message)
  if (!_configInitialized.has(sessionPath)) {
    const initPromises = [];
    const ensureFile = async (filePath, defaultData) => {
      if (!(await fs.pathExists(filePath))) {
        await fs.writeJSON(filePath, defaultData, { spaces: 2 });
      }
    };
    initPromises.push(ensureFile(MODE_FILE, { mode: "boy" }));
    initPromises.push(ensureFile(CONFIG_PATH, { users: {}, owners: [] }));
    initPromises.push(ensureFile(MODE_PREFIX_FILE, { modeprefix: true }));
    initPromises.push(ensureFile(PREFIX_FILE, { prefix: BOT_CONFIG.PREFIXE_COMMANDE }));
    initPromises.push(ensureFile(BRANDING_FILE, { name: "", phone: "", channelLink: "", description: "" }));
    initPromises.push(ensureFile(GROUP_CONFIG_PATH, { groups: {} }));
    initPromises.push(ensureFile(JID_FILE, { ownerLid: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    initPromises.push(ensureFile(RESPONS_FILE, { audioUrl: "https://files.catbox.moe/59g6u8.mp3", type: "notification_sound", createdAt: new Date().toISOString() }));
    await Promise.all(initPromises);
    _configInitialized.add(sessionPath);
  }

  return {
    CONFIG_PATH,
    MODE_PREFIX_FILE,
    PREFIX_FILE,
    BRANDING_FILE,
    GROUP_CONFIG_PATH,
    JID_FILE,
    RESPONS_FILE,
    SUDO_FILE,
    MODE_FILE
  };
}

const getConfig = async (CONFIG_PATH) => {
  try {
    return await readJsonCached(CONFIG_PATH, { users: {}, owners: [] });
  } catch {
    return { users: {}, owners: [] };
  }
};

const saveConfig = async (CONFIG_PATH, cfg) => {
  await fs.writeJSON(CONFIG_PATH, cfg, { spaces: 2 });
  jsonCache.delete(CONFIG_PATH);
};

const setOwner = async (CONFIG_PATH, user) => {
  const cfg = await getConfig(CONFIG_PATH);
  if (!cfg.owners) cfg.owners = [];
  const add = (num) => { if (num && !cfg.owners.includes(num)) cfg.owners.push(num); };
  if (user?.id) add(getBareNumber(user.id));
  if (user?.lid) add(getBareNumber(user.lid));
  await saveConfig(CONFIG_PATH, cfg);
  return cfg.owners;
};

const loadModePrefix = async (MODE_PREFIX_FILE) => {
  try {
    if (await fs.pathExists(MODE_PREFIX_FILE)) {
      const data = await readJsonCached(MODE_PREFIX_FILE, { modeprefix: true });
      return data.modeprefix ?? true;
    }
    return true;
  } catch {
    return true;
  }
};

const loadPrefix = async (PREFIX_FILE) => {
  try {
    if (await fs.pathExists(PREFIX_FILE)) {
      const data = await readJsonCached(PREFIX_FILE, { prefix: BOT_CONFIG.PREFIXE_COMMANDE });
      return (data?.prefix ?? BOT_CONFIG.PREFIXE_COMMANDE) || BOT_CONFIG.PREFIXE_COMMANDE;
    }
    return BOT_CONFIG.PREFIXE_COMMANDE;
  } catch {
    return BOT_CONFIG.PREFIXE_COMMANDE;
  }
};

const loadBranding = async (sessionPath) => {
  try {
    if (!sessionPath) return {};
    const file = path.join(sessionPath, "branding.json");
    if (!(await fs.pathExists(file))) return {};
    const data = await readJsonCached(file, {});
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
};

const loadSudo = async (SUDO_FILE) => {
  try {
    if (await fs.pathExists(SUDO_FILE)) {
      return await readJsonCached(SUDO_FILE, []);
    }
    return [];
  } catch {
    return [];
  }
};

const isGroupAdmin = async (sock, groupJid, userJid) => {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.find(p => p.id === userJid)?.admin !== null;
  } catch { return false; }
};

const readAudioUrl = async (RESPONS_FILE) => {
  try {
    if (await fs.pathExists(RESPONS_FILE)) {
      const responsData = await readJsonCached(RESPONS_FILE, { audioUrl: "https://files.catbox.moe/59g6u8.mp3" });
      return responsData.audioUrl || "https://files.catbox.moe/59g6u8.mp3";
    }
    return "https://files.catbox.moe/59g6u8.mp3";
  } catch {
    return "https://files.catbox.moe/59g6u8.mp3";
  }
};

const saveOwnerLid = async (JID_FILE, lid) => {
  try {
    let jidData = {};
    if (await fs.pathExists(JID_FILE)) {
      jidData = await readJsonCached(JID_FILE, {});
    }
    jidData.ownerLid = lid;
    jidData.updatedAt = new Date().toISOString();
    await fs.writeJSON(JID_FILE, jidData, { spaces: 2 });
    jsonCache.delete(JID_FILE);
  } catch (error) {
    logger.error(`Erreur lors de la sauvegarde du lid: ${error.message}`);
  }
};

/**
 * Classe BotManager - Gère les instances de bots
 */
class BotManager extends EventEmitter {
  constructor() {
    super();
    this.bots = new Map();
    this.pairingLocks = new Map();
    this._healthCheckInterval = null;
    this._recoverySweepInterval = null;
    this._lastConnectedCount = 0;
    this._lastConnectedCountTime = 0;
  }

  startBackgroundTasks() {
    if (this._healthCheckInterval) return;

    this._healthCheckInterval = setInterval(() => {
      this._runHealthCheck().catch(e => logger.error(`Health check error: ${e.message}`));
    }, BOT_CONFIG.HEALTH_CHECK_INTERVAL_MS);

    this._recoverySweepInterval = setInterval(() => {
      this._runRecoverySweep().catch(e => logger.error(`Recovery sweep error: ${e.message}`));
    }, BOT_CONFIG.RECOVERY_SWEEP_INTERVAL_MS);

    logger.info(`🩺 Health check (${BOT_CONFIG.HEALTH_CHECK_INTERVAL_MS / 1000}s) + Recovery sweep (${BOT_CONFIG.RECOVERY_SWEEP_INTERVAL_MS / 1000}s) démarrés`);
  }

  stopBackgroundTasks() {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
    if (this._recoverySweepInterval) {
      clearInterval(this._recoverySweepInterval);
      this._recoverySweepInterval = null;
    }
  }

  async _runHealthCheck() {
    let connectedCount = 0;
    for (const [uuid, bot] of this.bots) {
      if (bot.status !== "connected") continue;

      connectedCount++;
      const sock = bot.socket;
      const wsAlive = sock && sock.ws && (
        typeof sock.ws.isOpen !== "undefined" ? sock.ws.isOpen :
        (sock.ws.readyState === 1)
      );
      if (!wsAlive) {
        logger.warn(`🩺 Health check: bot ${uuid} marqué connected mais socket mort — redémarrage`);
        bot._reconnectAttempts = 0;
        this.restartBot(uuid).catch(e => {
          logger.error(`Health check restart ${uuid}: ${e.message}`);
        });
      }
    }

    const now = Date.now();
    if (connectedCount === 0 && this._lastConnectedCount > 0 && (now - this._lastConnectedCountTime) > 120000) {
      logger.error(`🚨 ALERTE CRITIQUE: 0 bots connectés (était ${this._lastConnectedCount} il y a 2+ min) — lancement recovery sweep immédiat`);
      this._runRecoverySweep().catch(e => logger.error(`Emergency recovery: ${e.message}`));
    }
    if (connectedCount > 0) {
      this._lastConnectedCount = connectedCount;
      this._lastConnectedCountTime = now;
    }
  }

  async _runRecoverySweep() {
    const recoverableStatuses = ["waiting_recovery", "error", "conflict", "disconnected"];
    const toRecover = [];

    for (const [uuid, bot] of this.bots) {
      if (!recoverableStatuses.includes(bot.status)) continue;
      if (bot.reconnectTimer) continue;
      // [24/7] Ne PAS relancer les bots arrêtés manuellement ou stoppés
      if (bot._manuallyStopped) continue;
      if (bot.status === "stopped") continue;
      toRecover.push(uuid);
    }

    if (toRecover.length === 0) return;

    const sessionChecks = await Promise.allSettled(
      toRecover.map(async (uuid) => {
        const has = await hasAuthState(uuid);
        return { uuid, has };
      })
    );

    const validUuids = sessionChecks
      .filter(r => r.status === "fulfilled" && r.value.has)
      .map(r => r.value.uuid);

    if (validUuids.length === 0) return;

    for (const uuid of validUuids) {
      const bot = this.bots.get(uuid);
      if (bot) {
        bot._reconnectAttempts = 0;
        bot._conflictCount = 0;
      }
    }

    const results = await Promise.allSettled(
      validUuids.map(async (uuid) => {
        logger.info(`🔄 Recovery sweep: tentative de relance du bot ${uuid} (était: ${this.bots.get(uuid)?.status})`);
        await this.startBot(uuid);
        return uuid;
      })
    );

    let recovered = 0;
    for (const r of results) {
      if (r.status === "fulfilled") recovered++;
      else logger.error(`Recovery sweep erreur: ${r.reason?.message || r.reason}`);
    }

    if (recovered > 0) {
      logger.info(`🔄 Recovery sweep: ${recovered} bot(s) relancé(s)`);
    }
  }

  async _cleanupBotSocket(uuid) {
    const bot = this.bots.get(uuid);
    if (!bot) return;

    if (bot.reconnectTimer) {
      clearTimeout(bot.reconnectTimer);
      bot.reconnectTimer = null;
    }

    if (bot.connectingWatchdog) {
      clearTimeout(bot.connectingWatchdog);
      bot.connectingWatchdog = null;
    }

    if (bot.socket) {
      try {
        if (bot.socket.ev) {
          bot.socket.ev.removeAllListeners();
        }
      } catch {}

      try {
        if (bot.socket.ws && typeof bot.socket.ws.close === "function") {
          bot.socket.ws.close();
        }
      } catch {}

      try {
        if (typeof bot.socket.end === "function") {
          await bot.socket.end(new Error("Bot cleanup"));
        }
      } catch {}

      bot.socket = null;
    }

    bot.sendQueue = null;
    bot.sendQueueRunning = false;
    bot.protectionManager = null;
  }

  getRuntimeStats() {
    const bots = Array.from(this.bots.values());
    const byStatus = bots.reduce((acc, b) => {
      const k = b.status || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    // [AMÉLIORÉ] Métriques enrichies pour le monitoring
    const totalQueuedMessages = bots.reduce((sum, b) => sum + (b.sendQueue?.length || 0), 0);
    const totalDroppedMessages = bots.reduce((sum, b) => sum + (b.sendQueueDropped || 0), 0);
    const mem = process.memoryUsage();

    return {
      botsTotal: bots.length,
      botsByStatus: byStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(mem.external / 1024 / 1024)}MB`,
      },
      queues: {
        totalPending: totalQueuedMessages,
        totalDropped: totalDroppedMessages,
      },
      node: process.version,
      platform: process.platform,
    };
  }

  /**
   * Crée une nouvelle instance de bot
   * @param {string} uuid - UUID unique du bot
   * @param {string} phoneNumber - Numéro WhatsApp
   * @param {boolean} usePairingLock - Active le lock d'appairage (désactiver pour la reconnexion au boot)
   * @returns {Promise<void>}
   */
  async createBot(uuid, phoneNumber, usePairingLock = true) {
    // Idempotent: si le bot existe déjà, on met à jour les infos et on continue
    if (this.bots.has(uuid)) {
      const existing = this.bots.get(uuid);
      existing.phoneNumber = phoneNumber;
      this.bots.set(uuid, existing);
      logger.info(`Bot déjà présent en mémoire: ${uuid} (${phoneNumber})`);
      return;
    }

    // Vérifier le lock d'appairage (uniquement pour le flow pairing)
    if (usePairingLock && this.pairingLocks.has(phoneNumber)) {
      throw new Error(`Un appairage est déjà en cours pour ce numéro`);
    }

    const sessionPath = path.join(__dirname, "..", "sessions", `bot_${uuid}`);
    await fs.ensureDir(sessionPath);

    // Initialiser les fichiers de configuration
    await loadBotConfig(sessionPath);

    // Créer l'entrée du bot
    this.bots.set(uuid, {
      uuid,
      phoneNumber,
      sessionPath,
      status: "pairing",
      socket: null,
      reconnectTimer: null,
      connectingWatchdog: null,
      sendQueue: null,
      sendQueueRunning: false,
      sendLastSentAt: 0,
      groupManager: createGroupManager(sessionPath),
      welcomeSent: false,
      pairingMethod: "code"
    });

    if (usePairingLock) this.pairingLocks.set(phoneNumber, uuid);
    logger.info(`Bot créé: ${uuid} (${phoneNumber})`);
  }

  /**
   * Démarre un bot (création de la socket Baileys)
   * @param {string} uuid - UUID du bot
   * @param {string} method - Méthode d'appairage: "code" (pairing code) ou "qr" (QR code)
   * @returns {Promise<string>} Pairing code si nécessaire (null en mode QR)
   */
  async startBot(uuid, method = "code") {
    const bot = this.bots.get(uuid);
    if (!bot) {
      throw new Error(`Bot ${uuid} introuvable`);
    }

    bot.pairingMethod = method === "qr" ? "qr" : "code";

    if (bot.socket && bot.status === "connected") {
      logger.warn(`Bot ${uuid} est déjà connecté`);
      return null;
    }

    // [24/7] Reset du flag d'arrêt manuel — le bot est relancé volontairement
    bot._manuallyStopped = false;

    // Nettoyage complet avant (re)start (sans changer le statut en "stopped")
    try {
      await this._cleanupBotSocket(uuid);
    } catch (e) {
      logger.debug(`Pre-start cleanup(${uuid}): ${e?.message || e}`);
    }

    try {
      // Charger les commandes si nécessaire
      await loadCommands();

      // Charger l'état d'authentification
      const { state, saveCreds } = await usePostgresAuthState(uuid);
      // [FIX] Ne calculer _isFirstPairing qu'une seule fois par cycle de vie du bot en mémoire.
      // Sans ça, une reconnexion 515 juste après la génération du pairing code (creds déjà
      // enregistrées entre-temps) écrasait le flag à false et le message de bienvenue +
      // création de compte web étaient silencieusement sautés.
      if (bot._isFirstPairing === undefined) {
        bot._isFirstPairing = !state.creds.registered;
      }
      const { version } = await fetchLatestBaileysVersion();

      // Créer la socket Baileys
      const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        msgRetryCounterCache: new Map(),
        keepAliveIntervalMs: BOT_CONFIG.KEEPALIVE_INTERVAL_MS,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 500,           // [OPTIMISÉ] Réduit de 2000 à 500ms
        defaultQueryTimeoutMs: 30000,       // [OPTIMISÉ] Réduit de 60s à 30s
        emitOwnEvents: false,
        maxMsgRetryCount: 5,
        fireInitQueries: true,
        syncFullHistory: false,             // [OPTIMISÉ] Pas de sync historique (accélère la connexion)
        markOnlineOnConnect: false,         // [OPTIMISÉ] Ne pas marquer en ligne (réduit les requêtes)
        shouldIgnoreJid: (jid) => jid?.endsWith("@broadcast")  // [OPTIMISÉ] Ignorer les broadcasts
      });

      // Baileys utilise un EventEmitter pour sock.ev; augmenter la limite évite les warnings lors des reconnexions
      try {
        sock.ev.setMaxListeners(50);
      } catch {}

      bot.socket = sock;
      sock.ev.on("creds.update", saveCreds);

      // [AMÉLIORÉ] Rate-limit/queue pour les envois sortants avec limite de taille
      // Protège contre la saturation mémoire en cas de spam
      const minDelayMs = parseInt(process.env.BOT_SEND_MIN_DELAY_MS || "350");
      const maxQueueSize = parseInt(process.env.BOT_MAX_QUEUE_SIZE || "500");
      bot.sendQueue = [];
      bot.sendQueueRunning = false;
      bot.sendLastSentAt = 0;
      bot.sendQueueDropped = 0; // Compteur de messages rejetés
      const originalSendMessage = sock.sendMessage.bind(sock);
      sock.sendMessage = async (...sendArgs) => {
        return await new Promise((resolve, reject) => {
          // Protection anti-saturation : rejeter si la queue est pleine
          if (bot.sendQueue.length >= maxQueueSize) {
            bot.sendQueueDropped++;
            if (bot.sendQueueDropped % 50 === 1) {
              logger.warn(`⚠️ Bot ${uuid}: queue pleine (${maxQueueSize}), ${bot.sendQueueDropped} messages rejetés au total`);
            }
            return reject(new Error(`Queue d'envoi pleine (${maxQueueSize} max). Message rejeté.`));
          }
          bot.sendQueue.push({ sendArgs, resolve, reject, enqueuedAt: Date.now() });
          this._drainSendQueue(uuid, originalSendMessage, minDelayMs).catch(() => {});
        });
      };

      // Gérer la connexion
      let pairingCode = null;

      if (!state.creds.registered && bot.pairingMethod !== "qr") {
        // [AMÉLIORÉ] Générer le pairing code avec retry interne
        // Attendre que la connexion WebSocket soit stable avant de demander le code
        const pairingDelay = parseInt(process.env.PAIRING_DELAY_MS || "4000");
        await new Promise(resolve => setTimeout(resolve, pairingDelay));

        const maxPairingAttempts = 3;
        for (let i = 0; i < maxPairingAttempts; i++) {
          try {
            pairingCode = await sock.requestPairingCode(bot.phoneNumber);
            logger.info(`Pairing code généré pour ${uuid}: ${pairingCode}`);
            this.emit("pairing-code", { uuid, pairingCode });
            break;
          } catch (err) {
            logger.error(`Erreur génération pairing code pour ${uuid} (tentative ${i + 1}/${maxPairingAttempts}): ${err.message}`);
            if (i === maxPairingAttempts - 1) {
              this.emit("pairing-error", { uuid, error: err.message });
              throw err;
            }
            // Attendre avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
          }
        }
      }
      // Mode QR : ne pas appeler requestPairingCode, Baileys émettra un `qr`
      // dans connection.update qui sera transformé en data URL (voir handleConnectionUpdate)

      // Configurer les événements de connexion
      sock.ev.on("connection.update", async (update) => {
        await this.handleConnectionUpdate(uuid, update);
      });

      // Configurer les événements de messages
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        await this.handleMessages(uuid, messages, type);
      });

      bot.status = state.creds.registered ? "connecting" : "pairing";
      await updateBotStatus(uuid, bot.status);

      // Watchdog: si bloqué en connecting trop longtemps, restart ciblé
      if (bot.connectingWatchdog) {
        clearTimeout(bot.connectingWatchdog);
        bot.connectingWatchdog = null;
      }
      if (bot.status === "connecting") {
        const connectingTimeoutMs = parseInt(process.env.BOT_CONNECTING_TIMEOUT_MS || "90000");
        bot.connectingWatchdog = setTimeout(() => {
          const current = this.bots.get(uuid);
          if (!current) return;
          if (current.status === "connecting") {
            logger.warn(`⏱️ Watchdog: bot ${uuid} bloqué en connecting, restart...`);
            this.restartBot(uuid).catch((e) => logger.error(`Watchdog restart ${uuid}: ${e.message}`));
          }
        }, connectingTimeoutMs);
      }

      return pairingCode;
    } catch (error) {
      logger.error(`Erreur lors du démarrage du bot ${uuid}: ${error.message}`);
      bot.status = "error";
      await updateBotStatus(uuid, "error");
      this.emit("bot-error", { uuid, error: error.message });
      throw error;
    }
  }

  /**
   * Gère les mises à jour de connexion
   */
  async handleConnectionUpdate(uuid, update) {
    const bot = this.bots.get(uuid);
    if (!bot) return;

    const { connection, lastDisconnect, qr } = update;

    try {
      if (qr && bot.pairingMethod === "qr" && bot.status !== "connected") {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, scale: 6 });
          logger.info(`QR code généré pour ${uuid}`);
          this.emit("qr-code", { uuid, qr: qrDataUrl });
        } catch (err) {
          logger.error(`Erreur génération QR code pour ${uuid}: ${err.message}`);
          this.emit("pairing-error", { uuid, error: err.message });
        }
      }

      if (connection === "open") {
        logger.info(`Bot ${uuid} connecte avec succes`);
        bot.status = "connected";
        bot._conflictCount = 0;
        bot._reconnectAttempts = 0;
        await updateBotStatus(uuid, "connected");

        if (bot.connectingWatchdog) {
          clearTimeout(bot.connectingWatchdog);
          bot.connectingWatchdog = null;
        }
        this.pairingLocks.delete(bot.phoneNumber);

        await this.initializeBot(uuid);

        this.emit("bot-connected", { uuid });
      }

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        logger.warn(`Bot ${uuid} deconnecte. Raison: ${reason}`);

        bot.status = "disconnected";
        await updateBotStatus(uuid, "disconnected");
        this.emit("bot-disconnected", { uuid, reason });

        if (bot.connectingWatchdog) {
          clearTimeout(bot.connectingWatchdog);
          bot.connectingWatchdog = null;
        }

        if (bot.reconnectTimer) {
          clearTimeout(bot.reconnectTimer);
          bot.reconnectTimer = null;
        }

        if (reason === DisconnectReason.loggedOut) {
          logger.warn(`Bot ${uuid} deconnecte (logged out). Nettoyage de la session.`);
          await deleteAuthState(uuid);
          await fs.remove(bot.sessionPath).catch(() => {});
          bot.status = "logged_out";
          await updateBotStatus(uuid, "logged_out");
          return;
        }

        if (reason === DisconnectReason.badSession) {
          logger.warn(`Bot ${uuid}: badSession détectée — suppression session + needs_repair`);
          await deleteAuthState(uuid);
          await fs.remove(bot.sessionPath).catch(() => {});
          bot.status = "logged_out";
          await updateBotStatus(uuid, "logged_out");
          return;
        }

        if (reason === DisconnectReason.connectionReplaced) {
          bot._conflictCount = (bot._conflictCount || 0) + 1;

          // [24/7] Ne jamais arrêter définitivement — juste augmenter le délai
          // Un conflit 440 signifie qu'un autre appareil a pris la session
          // On attend plus longtemps pour laisser l'autre session se fermer
          const conflictDelay = Math.min(60000 * bot._conflictCount, 300000);
          logger.warn(`Bot ${uuid}: conflit 440 (x${bot._conflictCount}) — réessai dans ${conflictDelay / 1000}s`);
          
          if (bot._conflictCount >= 10) {
            // Après 10 conflits, notifier mais continuer quand même
            logger.error(`⚠️ Bot ${uuid}: conflit persistant (${bot._conflictCount}x) — vérifier si un autre appareil utilise la session`);
            this.emit("bot-conflict", { uuid, conflictCount: bot._conflictCount });
          }

          bot.reconnectTimer = setTimeout(() => {
            this.startBot(uuid).catch(err => {
              logger.error(`Erreur reconnexion ${uuid}: ${err.message}`);
            });
          }, conflictDelay);
          return;
        }

        // [FIX] Vérifier si le bot a été arrêté manuellement — ne PAS reconnecter
        if (bot._manuallyStopped) {
          logger.info(`Bot ${uuid}: arrêté manuellement, pas de reconnexion.`);
          return;
        }

        bot._reconnectAttempts = (bot._reconnectAttempts || 0) + 1;

        // [24/7] PAS DE LIMITE de tentatives — le bot se reconnecte à l'infini
        // Le délai augmente progressivement pour éviter le spam mais ne s'arrête JAMAIS
        let delay;
        if (reason === DisconnectReason.connectionClosed) {
          // 428 = WhatsApp force un refresh périodique (normal, reconnexion instantanée)
          delay = Math.min(1000 * bot._reconnectAttempts, 5000);
          logger.info(`Bot ${uuid}: connectionClosed (428) — reconnexion dans ${delay}ms`);
        } else if (reason === DisconnectReason.timedOut) {
          delay = Math.min(2000 * bot._reconnectAttempts, 15000);
          logger.info(`Bot ${uuid}: timedOut — retry dans ${delay}ms`);
        } else if (reason === DisconnectReason.connectionLost) {
          delay = Math.min(3000 * bot._reconnectAttempts, 30000);
          logger.info(`Bot ${uuid}: connectionLost — retry dans ${delay / 1000}s`);
        } else if (reason === 515) {
          delay = 5000;
          logger.info(`Bot ${uuid}: server restart (515) — retry dans 5s`);
        } else {
          delay = Math.min(BOT_CONFIG.RECONNECT_DELAY * Math.pow(1.5, bot._reconnectAttempts - 1), 60000);
          logger.info(`Bot ${uuid}: raison ${reason} — retry dans ${Math.round(delay / 1000)}s`);
        }

        logger.info(`🔄 Reconnexion ${uuid} dans ${Math.round(delay / 1000)}s (tentative #${bot._reconnectAttempts})`);
        bot.reconnectTimer = setTimeout(() => {
          this.startBot(uuid).catch(err => {
            logger.error(`Erreur reconnexion ${uuid}: ${err.message}`);
            // [24/7] Même si startBot échoue, reprogrammer une tentative
            if (!bot._manuallyStopped) {
              const retryDelay = Math.min(10000 * (bot._reconnectAttempts || 1), 60000);
              logger.info(`🔄 Reprogrammation reconnexion ${uuid} dans ${retryDelay / 1000}s après échec`);
              bot.reconnectTimer = setTimeout(() => {
                this.startBot(uuid).catch(() => {});
              }, retryDelay);
            }
          });
        }, delay);
      }
    } catch (err) {
      logger.error(`Erreur handleConnectionUpdate ${uuid}: ${err.message}`);
    }
  }

  /**
   * Initialise un bot après connexion
   */
  async initializeBot(uuid) {
    const bot = this.bots.get(uuid);
    if (!bot || !bot.socket) return;

    const configFiles = await loadBotConfig(bot.sessionPath);
    const sock = bot.socket;

    // Charger la configuration
    const isPrefixMode = await loadModePrefix(configFiles.MODE_PREFIX_FILE);
    const owners = await setOwner(configFiles.CONFIG_PATH, sock.user);
    const audioUrl = await readAudioUrl(configFiles.RESPONS_FILE);

    const ownerBare = getBareNumber(sock.user?.id);
    const ownerLid = sock.user?.lid ? getBareNumber(sock.user.lid) : null;

    if (ownerLid) {
      await saveOwnerLid(configFiles.JID_FILE, ownerLid);
    }

    // Initialiser les protections (per-bot isolation)
    try {
      if (!bot.groupManager) bot.groupManager = createGroupManager(bot.sessionPath);
      bot.protectionManager = initProtections(sock, ownerBare, bot.sessionPath, bot.groupManager);
      logger.info(`Protections.js chargé pour ${uuid}`);
    } catch (e) {
      logger.error(`Erreur chargement protections.js pour ${uuid}: ${e.message}`);
    }

    try {
      initProtections2(sock, ownerBare, bot.sessionPath);
      logger.info(`Protections2.js chargé pour ${uuid}`);
    } catch (e) {
      logger.error(`Erreur chargement protections2.js pour ${uuid}: ${e.message}`);
    }

    // [ABONNEMENT] Création automatique du compte web (essai gratuit 24h).
    // [SELF-HEAL] Basé sur l'état réel en DB (account.username absent), PAS sur un flag
    // en mémoire — ainsi, même si le message de bienvenue a été raté lors d'une reconnexion
    // précoce (ex: 515 juste après le pairing), le compte + les identifiants seront quand
    // même créés et envoyés dès la prochaine connexion réussie.
    let accountLines = [];
    let newAccountCreated = false;
    try {
      const account = await dbGetBotAccount(uuid);
      if (account && !account.username) {
        const { username, password } = generateCredentials(ownerBare);
        const passwordHash = await bcrypt.hash(password, 10);
        const trialMs = SUBSCRIPTION_PLANS.trial.durationMs;
        await dbSetBotAccount(uuid, {
          username,
          passwordHash,
          subscriptionPlan: "trial",
          subscriptionExpiresAt: new Date(Date.now() + trialMs).toISOString(),
          trialUsed: true,
        });
        accountLines = [
          "",
          "*🔑 TON COMPTE SIGMA MDX*",
          `Identifiant: ${username}`,
          `Mot de passe: ${password}`,
          "",
          "🎁 Essai gratuit de 24h activé !",
          "Gère ton abonnement sur le site (page de connexion) avant expiration pour ne pas être déconnecté.",
        ];
        newAccountCreated = true;
        logger.info(`🔑 Compte web créé pour bot ${uuid} (username: ${username})`);
      }
    } catch (e) {
      logger.error(`Erreur création compte web pour ${uuid}: ${e.message}`);
    }

    // [NO SPAM] Message de bienvenue complet envoyé UNIQUEMENT lors du tout premier pairing
    // (pas à chaque reconnexion) — mais si un compte vient d'être créé (self-heal ci-dessus),
    // on envoie quand même les identifiants même si le message "complet" a déjà été raté.
    if ((bot._isFirstPairing && !bot._welcomeSent) || newAccountCreated) {
      bot._welcomeSent = true;
      bot._isFirstPairing = false;
      try {
        const ownerJid = `${ownerBare}@s.whatsapp.net`;
        const commandsCount = Object.keys(await loadCommands()).length;

        await sock.sendMessage(ownerJid, {
          text: [
            "*SIGMA MDX DEPLOY ACTIF* 🚀",
            "",
            `⚙️ Mode: ${isPrefixMode ? 'Prefix' : 'Sans prefix'}`,
            `📋 Commandes: ${commandsCount}`,
            ...accountLines,
            "",
            `💡 Tapez ${isPrefixMode ? BOT_CONFIG.PREFIXE_COMMANDE : ''}menu pour commencer`,
            "",
            `Merci d'avoir choisi SIGMA MDX ! 🌌`
          ].join("\n")
        });
        logger.info(`🎉 Message de bienvenue envoyé au propriétaire du bot ${uuid}`);
      } catch (e) {
        logger.warn(`Message de bienvenue échoué pour ${uuid}: ${e.message}`);
      }
    }

    logger.info(`✅ Bot ${uuid} initialisé`);
  }

  /**
   * [DELMSGS] Mémorise l'ID d'un message reçu dans un groupe, par expéditeur,
   * pour permettre une suppression groupée ultérieure (.delmsgs).
   * Fenêtre glissante bornée en mémoire (par expéditeur et par groupe) — aucune persistance disque.
   */
  _trackGroupMessage(bot, groupJid, senderJid, msgId) {
    if (!bot._groupMsgCache) bot._groupMsgCache = new Map();
    let groupCache = bot._groupMsgCache.get(groupJid);
    if (!groupCache) {
      groupCache = new Map();
      bot._groupMsgCache.set(groupJid, groupCache);
    }
    let userMsgs = groupCache.get(senderJid);
    if (!userMsgs) {
      userMsgs = [];
      groupCache.set(senderJid, userMsgs);
    }
    userMsgs.push({ id: msgId, ts: Date.now() });

    const MAX_PER_USER = 300;
    if (userMsgs.length > MAX_PER_USER) userMsgs.shift();

    // Protection mémoire : borne le nombre d'expéditeurs suivis par groupe
    const MAX_SENDERS_PER_GROUP = 500;
    if (groupCache.size > MAX_SENDERS_PER_GROUP) {
      const oldestSender = groupCache.keys().next().value;
      groupCache.delete(oldestSender);
    }
  }

  /**
   * [DELMSGS] Retourne les IDs de messages mémorisés (non expirés) d'un utilisateur dans un groupe.
   */
  getCachedMessagesForUser(uuid, groupJid, userJid) {
    const bot = this.bots.get(uuid);
    const list = bot?._groupMsgCache?.get(groupJid)?.get(userJid) || [];
    const TTL_MS = 48 * 60 * 60 * 1000; // 48h
    const now = Date.now();
    return list.filter((m) => now - m.ts <= TTL_MS).map((m) => m.id);
  }

  /**
   * [DELMSGS] Vide le cache de messages d'un utilisateur dans un groupe (après suppression réussie).
   */
  clearCachedMessagesForUser(uuid, groupJid, userJid) {
    const bot = this.bots.get(uuid);
    bot?._groupMsgCache?.get(groupJid)?.delete(userJid);
  }

  /**
   * Gère les messages reçus
   */
  async handleMessages(uuid, messages, type) {
    // [FIX] Accepter UNIQUEMENT 'notify' pour éviter la double exécution (notify + append)
    if (type !== "notify") return;
    const bot = this.bots.get(uuid);
    if (!bot || !bot.socket) return;

    const msg = messages?.[0];
    if (!msg?.message) return;

    // [FIX] Déduplication par message ID pour éviter les exécutions multiples
    const msgId = msg.key.id;
    if (!bot._processedMsgIds) bot._processedMsgIds = new Set();
    if (bot._processedMsgIds.has(msgId)) return;
    bot._processedMsgIds.add(msgId);
    // Nettoyer les anciens IDs après 30s pour éviter les fuites mémoire
    setTimeout(() => bot._processedMsgIds?.delete(msgId), 30000);

    const sock = bot.socket;
    const from = msg.key.remoteJid;
    const isGroup = from?.endsWith("@g.us");
    const sender = msg.key.fromMe ? sock.user?.id : (msg.key.participant || from);
    const senderNum = getBareNumber(sender);

    // [ISOLATION 300 BOTS] Ignorer les messages envoyés par d'autres bots de la plateforme
    // Chaque bot a un numéro unique (bot.phoneNumber). Si le sender est un autre bot, ignorer.
    if (!msg.key.fromMe && senderNum) {
      for (const [otherUuid, otherBot] of this.bots) {
        if (otherUuid === uuid) continue; // Ne pas se comparer à soi-même
        if (otherBot.phoneNumber && getBareNumber(otherBot.phoneNumber + "@s.whatsapp.net") === senderNum) {
          // Le message vient d'un autre bot de la plateforme — ignorer
          return;
        }
      }
    }

    // [DELMSGS] Mémoriser les IDs de messages par groupe/expéditeur pour permettre une suppression groupée (.delmsgs)
    if (isGroup && !msg.key.fromMe && sender && msg.key.id) {
      this._trackGroupMessage(bot, from, sender, msg.key.id);
    }

    // [OPTIMISÉ] Extraire le texte EN PREMIER pour rejeter rapidement les non-commandes
    const text = pickText(unwrapMessage(msg.message));
    if (!text) return;

    // [OPTIMISÉ] Charger la config et les settings en parallèle (pas séquentiellement)
    const configFiles = await loadBotConfig(bot.sessionPath);
    const [isPrefixMode, commandPrefix, config, sudoList] = await Promise.all([
      loadModePrefix(configFiles.MODE_PREFIX_FILE),
      loadPrefix(configFiles.PREFIX_FILE),
      getConfig(configFiles.CONFIG_PATH),
      loadSudo(configFiles.SUDO_FILE)
    ]);
    const owners = config.owners || [];
    const isSudo = sudoList.includes(senderNum);
    const isOwner = owners.includes(senderNum) || !!msg.key.fromMe || owners.includes(getBareNumber(from));

    // [ISOLATION 300 BOTS] Dans un groupe, seul l'owner/sudo de CE bot peut lui donner des commandes
    // Les autres utilisateurs dans le groupe ne déclenchent PAS les commandes de ce bot
    if (isGroup && !isOwner && !isSudo) {
      return; // Pas owner/sudo de ce bot — ignorer dans les groupes
    }

    logger.debug(`📨 Message de ${senderNum} | owner=${isOwner} sudo=${isSudo}`);

    if (isGroup && isOwner) {
      if (!bot.groupManager) bot.groupManager = createGroupManager(bot.sessionPath);
      bot.groupManager.registerGroupOnOwnerMessage(from);
    }

    let cmdName = null;
    let args = [];

    if (isPrefixMode) {
      if (!text.startsWith(commandPrefix)) return;
      args = text.slice(commandPrefix.length).trim().split(/ +/);
      cmdName = args.shift()?.toLowerCase();
    } else {
      args = text.trim().split(/ +/);
      cmdName = args.shift()?.toLowerCase();
      if (cmdName?.startsWith(commandPrefix)) return;
    }

    const cmd = (await loadCommands())[cmdName];
    if (!cmd) return; // Commande inconnue, ignorer silencieusement

    if (cmd.ownerOnly && !isOwner) {
      await sock.sendMessage(from, { text: "Owner only." });
      return;
    }

    // [OPTIMISÉ] Réaction envoyée en parallèle (non-bloquante) pour ne pas retarder la commande
    const botMode = await getBotMode(bot.sessionPath);
    const reactEmoji = getReactionEmoji(botMode);
    sock.sendMessage(from, { react: { text: reactEmoji, key: msg.key } }).catch(() => {});

    logger.info(`⚡ ${cmdName} par ${senderNum}`);

    const botContext = {
      sessionPath: bot.sessionPath, owners, sudoList, uuid, isOwner, isSudo, groupManager: bot.groupManager,
      protectionManager: bot.protectionManager,
      getUserMessageIds: (groupJid, userJid) => this.getCachedMessagesForUser(uuid, groupJid, userJid),
      clearUserMessages: (groupJid, userJid) => this.clearCachedMessagesForUser(uuid, groupJid, userJid)
    };
    // [AMÉLIORÉ] Timeout configurable par commande, avec meilleure gestion des erreurs
    const CMD_TIMEOUT_MS = parseInt(process.env.CMD_TIMEOUT_MS || "60000");
    const cmdStartTime = Date.now();
    try {
      const exec = cmd.execute;
      const cmdPromise = exec.length >= 5 ? exec(sock, msg, args, from, botContext) : exec(sock, msg, args, from);
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timeout: commande ${cmdName} a dépassé ${CMD_TIMEOUT_MS / 1000}s`)), CMD_TIMEOUT_MS);
      });
      try {
        await Promise.race([cmdPromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
      // Absorber les rejets non gérés de la promesse originale
      cmdPromise.catch(() => {});
      const duration = Date.now() - cmdStartTime;
      logger.info(`✅ Commande ${cmdName} exécutée avec succès (${duration}ms)`);
      // Alerter si la commande est lente
      if (duration > 10000) {
        logger.warn(`⚠️ Commande lente: ${cmdName} a pris ${duration}ms pour ${uuid}`);
      }
    } catch (err) {
      const duration = Date.now() - cmdStartTime;
      logger.error(`❌ Erreur dans ${cmdName} pour ${uuid} (${duration}ms): ${err.message}`);
      // Ne pas logger le stack complet pour les timeouts (bruit)
      if (!err.message.includes("Timeout")) {
        logger.error(`Stack: ${err.stack}`);
      }
      try {
        // Limiter la taille du message d'erreur envoyé à l'utilisateur
        const safeError = (err.message || "Erreur inconnue").slice(0, 200);
        await sock.sendMessage(from, { 
          text: `> ❌ Erreur lors de l'exécution de la commande \`${cmdName}\`\n> Détails: ${safeError}` 
        }, { quoted: msg });
      } catch (sendErr) {
        logger.error(`❌ Impossible d'envoyer le message d'erreur: ${sendErr.message}`);
      }
    }
  }

  /**
   * Arrête un bot
   */
  async stopBot(uuid) {
    const bot = this.bots.get(uuid);
    if (!bot) {
      throw new Error(`Bot ${uuid} introuvable`);
    }

    // [24/7] Marquer comme arrêté manuellement pour empêcher la reconnexion automatique
    bot._manuallyStopped = true;

    // Annuler tout timer de reconnexion en cours
    if (bot.reconnectTimer) {
      clearTimeout(bot.reconnectTimer);
      bot.reconnectTimer = null;
    }

    try {
      await this._cleanupBotSocket(uuid);
    } catch (e) {
      logger.warn(`Erreur cleanup socket ${uuid}: ${e.message}`);
    }

    bot.status = "stopped";
    await updateBotStatus(uuid, "stopped");
    logger.info(`⏹️ Bot ${uuid} arrêté manuellement (pas de reconnexion auto)`);
  }

  async _drainSendQueue(uuid, originalSendMessage, minDelayMs) {
    const bot = this.bots.get(uuid);
    if (!bot || bot.sendQueueRunning) return;
    bot.sendQueueRunning = true;

    // [AMÉLIORÉ] TTL pour les messages en queue (30s max d'attente)
    const MESSAGE_TTL_MS = parseInt(process.env.BOT_SEND_TTL_MS || "30000");

    try {
      while (bot.sendQueue && bot.sendQueue.length > 0) {
        const now = Date.now();
        const wait = Math.max(0, (bot.sendLastSentAt + minDelayMs) - now);
        if (wait > 0) {
          await new Promise((r) => setTimeout(r, wait));
        }

        const item = bot.sendQueue.shift();
        if (!item) break;

        // Vérifier le TTL : rejeter les messages trop vieux
        if (item.enqueuedAt && (Date.now() - item.enqueuedAt) > MESSAGE_TTL_MS) {
          item.reject(new Error(`Message expiré (TTL ${MESSAGE_TTL_MS}ms dépassé)`));
          continue;
        }

        try {
          const res = await originalSendMessage(...item.sendArgs);
          bot.sendLastSentAt = Date.now();
          item.resolve(res);
        } catch (e) {
          bot.sendLastSentAt = Date.now();
          item.reject(e);
          // Si erreur de connexion, ne pas continuer à drainer
          if (e?.message?.includes("Connection Closed") || e?.message?.includes("not open")) {
            logger.warn(`⚠️ Bot ${uuid}: connexion fermée pendant le drain, arrêt de la queue`);
            break;
          }
        }
      }
    } finally {
      if (bot) bot.sendQueueRunning = false;
    }
  }

  /**
   * Redémarre un bot
   */
  async restartBot(uuid) {
    await this.stopBot(uuid);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await this.startBot(uuid);
  }

  /**
   * Supprime complètement un bot
   */
  async deleteBot(uuid) {
    const bot = this.bots.get(uuid);
    if (!bot) {
      throw new Error(`Bot ${uuid} introuvable`);
    }

    await this.stopBot(uuid);
    this.pairingLocks.delete(bot.phoneNumber);
    this.bots.delete(uuid);

    try {
      await deleteAuthState(uuid);
      await fs.remove(bot.sessionPath);
      logger.info(`Session supprimée pour ${uuid}`);
    } catch (e) {
      logger.error(`Erreur suppression session ${uuid}: ${e.message}`);
    }
  }

  /**
   * Récupère le statut d'un bot
   */
  getBotStatus(uuid) {
    const bot = this.bots.get(uuid);
    if (!bot) return null;

    return {
      uuid: bot.uuid,
      phoneNumber: bot.phoneNumber,
      status: bot.status,
      sessionPath: bot.sessionPath
    };
  }

  /**
   * Liste tous les bots actifs
   */
  listBots() {
    return Array.from(this.bots.values()).map(bot => ({
      uuid: bot.uuid,
      phoneNumber: bot.phoneNumber,
      status: bot.status
    }));
  }
}

// Instance singleton
const botManager = new BotManager();
export default botManager;
