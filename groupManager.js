// groupManager.js
// Stockage PostgreSQL + cache mémoire — remplace les fichiers group.json
import path from "path";
import { dbGetAllGroupProtections, dbSetGroupProtections } from "./src/db.js";

const DEFAULT_PROTECTIONS = {
  antiLink: false,
  antiPromote1: false,
  antiDemote: false,
  antiBot: false,
  antiSpam: false,
  autoReact: false,
  statusLike: false,
  warnAdmin: false,
  antiSticker: false,
  antiVoice: false,
  antiVideo: false,
  sigmaVoice: false,
  autoSigmaChatTTS: true,
  antiMessage: false,
  alertAdmin: false,
  respons: true,
  sigmaChat: true,
  welcome: false,
  goodbye: false,
  autoVV2: false,
  autoSigmaChat: false,
  antiWord: false,
  antiDelete: false
};

// Extrait l'UUID du sessionPath (./sessions/bot_<UUID>)
const uuidFromSessionPath = (sessionPath) => {
  if (!sessionPath) return null;
  const base = path.basename(sessionPath);
  return base.startsWith("bot_") ? base.slice(4) : null;
};

/**
 * Crée un gestionnaire de groupes isolé pour une session bot donnée.
 * Cache mémoire synchrone + persistence PostgreSQL asynchrone.
 */
export const createGroupManager = (sessionPath) => {
  const uuid = uuidFromSessionPath(sessionPath);
  const cache = {}; // groupJid → { protection: bool, ... }

  // Chargement initial depuis la DB (asynchrone)
  if (uuid) {
    dbGetAllGroupProtections(uuid)
      .then((rows) => {
        for (const row of rows) {
          cache[row.groupJid] = row.protections;
        }
      })
      .catch((err) => {
        console.error(`[GroupManager] Erreur chargement DB (${uuid}): ${err.message}`);
      });
  }

  const persistToDB = (groupJid) => {
    if (!uuid) return;
    dbSetGroupProtections(uuid, groupJid, cache[groupJid]).catch((err) => {
      console.error(`[GroupManager] Erreur écriture DB (${uuid}/${groupJid}): ${err.message}`);
    });
  };

  const getGroupProtections = (groupJid) => {
    return cache[groupJid] || {};
  };

  const setGroupProtection = (groupJid, protection, value) => {
    if (!cache[groupJid]) cache[groupJid] = {};
    cache[groupJid][protection] = value;
    persistToDB(groupJid);
  };

  const toggleGroupProtection = (groupJid, protection) => {
    const current = getGroupProtections(groupJid)[protection] ?? false;
    setGroupProtection(groupJid, protection, !current);
    return !current;
  };

  const registerGroupOnOwnerMessage = (groupJid) => {
    if (cache[groupJid]) return;
    cache[groupJid] = { ...DEFAULT_PROTECTIONS };
    persistToDB(groupJid);
    console.log(`[GROUP MANAGER] Nouveau groupe : ${groupJid.split("@")[0]}`);
  };

  // === [WARN SYSTEM] Avertissements par utilisateur, stockés dans le même blob JSONB que les protections ===
  const getWarnCount = (groupJid, userJid) => {
    return cache[groupJid]?._warns?.[userJid] || 0;
  };

  const addWarn = (groupJid, userJid) => {
    if (!cache[groupJid]) cache[groupJid] = { ...DEFAULT_PROTECTIONS };
    if (!cache[groupJid]._warns) cache[groupJid]._warns = {};
    const next = (cache[groupJid]._warns[userJid] || 0) + 1;
    cache[groupJid]._warns[userJid] = next;
    persistToDB(groupJid);
    return next;
  };

  const resetWarn = (groupJid, userJid) => {
    if (cache[groupJid]?._warns) {
      delete cache[groupJid]._warns[userJid];
      persistToDB(groupJid);
    }
  };

  // === [ANTIWORD] Liste de mots interdits par groupe, stockée dans le même blob JSONB ===
  const getBannedWords = (groupJid) => {
    return cache[groupJid]?._bannedWords || [];
  };

  const addBannedWord = (groupJid, word) => {
    if (!cache[groupJid]) cache[groupJid] = { ...DEFAULT_PROTECTIONS };
    if (!cache[groupJid]._bannedWords) cache[groupJid]._bannedWords = [];
    const normalized = String(word || "").trim().toLowerCase();
    if (!normalized) return getBannedWords(groupJid);
    if (!cache[groupJid]._bannedWords.includes(normalized)) {
      cache[groupJid]._bannedWords.push(normalized);
      persistToDB(groupJid);
    }
    return cache[groupJid]._bannedWords;
  };

  const removeBannedWord = (groupJid, word) => {
    if (!cache[groupJid]?._bannedWords) return [];
    const normalized = String(word || "").trim().toLowerCase();
    cache[groupJid]._bannedWords = cache[groupJid]._bannedWords.filter((w) => w !== normalized);
    persistToDB(groupJid);
    return cache[groupJid]._bannedWords;
  };

  return {
    getGroupProtections,
    setGroupProtection,
    toggleGroupProtection,
    registerGroupOnOwnerMessage,
    getWarnCount,
    addWarn,
    resetWarn,
    getBannedWords,
    addBannedWord,
    removeBannedWord
  };
};

// API globale (legacy — utilisée sans sessionPath, sans isolation)
let _globalCache = {};
let _globalUuid = null;

const _persistGlobal = (groupJid) => {
  if (!_globalUuid) return;
  dbSetGroupProtections(_globalUuid, groupJid, _globalCache[groupJid]).catch((err) => {
    console.error(`[GroupManager] Erreur écriture globale: ${err.message}`);
  });
};

export const getGroupProtections = (groupJid) => _globalCache[groupJid] || {};

export const setGroupProtection = (groupJid, protection, value) => {
  if (!_globalCache[groupJid]) _globalCache[groupJid] = {};
  _globalCache[groupJid][protection] = value;
  _persistGlobal(groupJid);
};

export const toggleGroupProtection = (groupJid, protection) => {
  const current = getGroupProtections(groupJid)[protection] ?? false;
  setGroupProtection(groupJid, protection, !current);
  return !current;
};

export const registerGroupOnOwnerMessage = (groupJid) => {
  if (_globalCache[groupJid]) return;
  _globalCache[groupJid] = { ...DEFAULT_PROTECTIONS };
  _persistGlobal(groupJid);
  console.log(`[GROUP MANAGER] Nouveau groupe : ${groupJid.split("@")[0]}`);
};

export default {
  getGroupProtections,
  setGroupProtection,
  toggleGroupProtection,
  registerGroupOnOwnerMessage,
  createGroupManager
};
