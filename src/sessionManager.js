/**
 * Gestionnaire de sessions et tokens
 * Stockage PostgreSQL — remplace les fichiers bots.json / tokens.json
 */
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import logger from "./utils/logger.js";
import {
  dbInsertBot,
  dbUpdateBotStatus,
  dbGetBotByUUID,
  dbGetBotByToken,
  dbDeleteBot,
  dbListAllBots
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache mémoire pour les lectures fréquentes
const botsCache = new Map();   // uuid → botData
const tokensCache = new Map(); // token → uuid

// Remplir le cache au démarrage
async function warmCache() {
  try {
    const bots = await dbListAllBots();
    for (const bot of bots) {
      const entry = normalizeBotEntry(bot);
      botsCache.set(entry.uuid, entry);
      tokensCache.set(entry.token, entry.uuid);
    }
    logger.info(`[SessionManager] Cache initialisé: ${botsCache.size} bot(s)`);
  } catch (err) {
    logger.error(`[SessionManager] Erreur warmCache: ${err.message}`);
  }
}

const normalizeBotEntry = (row) => ({
  uuid: row.uuid,
  phoneNumber: row.phoneNumber,
  token: row.token,
  status: row.status || "pairing",
  createdAt: row.createdAt || new Date().toISOString(),
  lastConnected: row.lastConnected || null,
  sessionPath: `./sessions/bot_${row.uuid}`
});

await warmCache();

// ─────────────────────────────────────────────────────────────────────────────

export function generateUUID() {
  return crypto.randomUUID();
}

export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function loadBots() {
  const obj = {};
  for (const [uuid, data] of botsCache) obj[uuid] = data;
  return obj;
}

export async function loadTokens() {
  const obj = {};
  for (const [token, uuid] of tokensCache) obj[token] = uuid;
  return obj;
}

export async function saveBots() {
  // No-op: DB is the source of truth. Kept for API compatibility.
}

export async function saveTokens() {
  // No-op: DB is the source of truth. Kept for API compatibility.
}

export async function createBot(uuid, phoneNumber) {
  // Générer un token unique
  let token = generateToken();
  while (tokensCache.has(token)) token = generateToken();

  await dbInsertBot(uuid, phoneNumber, token);

  const entry = normalizeBotEntry({ uuid, phoneNumber, token, status: "pairing" });
  botsCache.set(uuid, entry);
  tokensCache.set(token, uuid);

  logger.info(`[SessionManager] Bot créé: ${uuid} (${phoneNumber})`);
  return token;
}

export async function updateBotStatus(uuid, status) {
  const cached = botsCache.get(uuid);
  if (!cached) {
    logger.warn(`[SessionManager] updateBotStatus: bot ${uuid} introuvable en cache`);
    return;
  }

  cached.status = status;
  if (status === "connected") cached.lastConnected = new Date().toISOString();

  // Écriture DB non-bloquante
  dbUpdateBotStatus(uuid, status).catch(err =>
    logger.error(`[SessionManager] Erreur DB updateBotStatus: ${err.message}`)
  );

  logger.info(`Statut mis à jour: ${uuid} -> ${status}`);
}

export async function getBotByUUID(uuid) {
  if (botsCache.has(uuid)) return botsCache.get(uuid);
  const row = await dbGetBotByUUID(uuid);
  if (!row) return null;
  const entry = normalizeBotEntry(row);
  botsCache.set(uuid, entry);
  tokensCache.set(entry.token, uuid);
  return entry;
}

export async function getBotByToken(token) {
  const uuid = tokensCache.get(token);
  if (uuid) return botsCache.get(uuid) || null;
  const row = await dbGetBotByToken(token);
  if (!row) return null;
  const entry = normalizeBotEntry(row);
  botsCache.set(entry.uuid, entry);
  tokensCache.set(token, entry.uuid);
  return entry;
}

export async function deleteBot(uuid) {
  const cached = botsCache.get(uuid);
  if (!cached) throw new Error(`Bot ${uuid} introuvable`);

  tokensCache.delete(cached.token);
  botsCache.delete(uuid);

  await dbDeleteBot(uuid);
  logger.info(`[SessionManager] Bot supprimé: ${uuid}`);
}

export async function listAllBots() {
  if (botsCache.size > 0) return Array.from(botsCache.values());
  const rows = await dbListAllBots();
  return rows.map(normalizeBotEntry);
}
