import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import pino from "pino";
import { Boom } from "@hapi/boom";
import dotenv from "dotenv";
import { initProtections } from "./protections.js";
import { initProtections as initProtections2 } from "./protections2.js";
import { registerGroupOnOwnerMessage } from "./groupManager.js";
import bugCommands from "./bug.js";
import { getMode } from "./commands/mode.js";
import { getReactionEmoji } from "./src/utils/botMode.js";

dotenv.config();

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// SIGNATURE, CHANNEL, MÉDIAS ET AUDIO - HARDCODÉ POUR OBFUSCATION
// ═══════════════════════════════════════════════════════════════
const BOT_SIGNATURE = "*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*";
const CHANNEL_INFO = {
    id: "120363422898149393@newsletter",
    name: "💢𝚂𝙸𝙶𝙼𝙰 𝙼𝙳𝚇💢",
    url: "https://whatsapp.com/channel/0029VbBIAP58KMqoJluW8r06"
};
const MENU_AUDIO = "https://files.catbox.moe/59g6u8.mp3";

// Images pour le mode GIRL
const GIRL_IMAGES = [
    { type: "image", url: "https://files.catbox.moe/gif51b.jpg" },
    { type: "image", url: "https://files.catbox.moe/s0opn7.jpg" },
    { type: "image", url: "https://files.catbox.moe/lhpf7b.jpg" },
    { type: "image", url: "https://files.catbox.moe/degxst.jpg" },
    { type: "image", url: "https://files.catbox.moe/weqqt6.jpg" },
    { type: "image", url: "https://files.catbox.moe/5j2ukc.jpg" },
    { type: "image", url: "https://files.catbox.moe/2g94h4.jpg" },
    { type: "image", url: "https://files.catbox.moe/z7h6nj.jpg" },
    { type: "image", url: "https://files.catbox.moe/e945km.jpg" },
    { type: "image", url: "https://files.catbox.moe/tdh6zq.jpg" }
];

// Images pour le mode BOY
const BOY_IMAGES = [
    { type: "image", url: "https://files.catbox.moe/6uizvk.jpg" },
    { type: "image", url: "https://files.catbox.moe/m34aop.jpg" },
    { type: "image", url: "https://files.catbox.moe/jwbrkr.jpg" },
    { type: "image", url: "https://files.catbox.moe/y7c9p5.jpg" },
    { type: "image", url: "https://files.catbox.moe/a33171.jpg" },
    { type: "image", url: "https://files.catbox.moe/2zl7vk.jpg" },
    { type: "image", url: "https://files.catbox.moe/dnq77s.jpg" },
    { type: "image", url: "https://files.catbox.moe/312znf.jpg" },
    { type: "image", url: "https://files.catbox.moe/5le1e7.jpg" }
];

// Images par défaut (fallback)
const DEFAULT_MEDIAS = [
    { type: "video", url: "https://files.catbox.moe/opdrz6.mp4" },
    { type: "image", url: "https://files.catbox.moe/gpsy0t.jpg" },
    { type: "video", url: "https://files.catbox.moe/gpwjm1.mp4" }
];

let menuMediaIndex = { girl: 0, boy: 0, default: 0 };
// ═══════════════════════════════════════════════════════════════

// =================== CONFIGURATION ===================
const config = {
  PREFIXE_COMMANDE: process.env.PREFIXE || "!",
  DOSSIER_AUTH: process.env.DOSSIER_AUTH || "session",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY) || 5000
};

// =================== LOGGER ===================
const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: { colorize: true, ignore: "pid,hostname", translateTime: "HH:MM:ss" }
  },
  base: null
});

// =================== FICHIERS ===================
const SUDO_FILE = "./sudo.json";
const CONFIG_PATH = "./config.json";
const MODE_PREFIX_FILE = "./modeprefix.json";
const GROUP_CONFIG_PATH = "./group.json";
const JID_FILE = "./jid.json";          // Fichier pour le lid de l'owner
const RESPONS_FILE = "./respons.json";  // Fichier pour l'URL du son

// Init files
if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify({ users: {}, owners: [] }, null, 2));
if (!fs.existsSync(MODE_PREFIX_FILE)) fs.writeFileSync(MODE_PREFIX_FILE, JSON.stringify({ modeprefix: true }, null, 2));
if (!fs.existsSync(GROUP_CONFIG_PATH)) fs.writeFileSync(GROUP_CONFIG_PATH, JSON.stringify({ groups: {} }, null, 2));

// Initialiser jid.json avec une structure vide
if (!fs.existsSync(JID_FILE)) {
  fs.writeFileSync(JID_FILE, JSON.stringify({ 
    ownerLid: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, null, 2));
}

// Initialiser respons.json avec l'URL du son
if (!fs.existsSync(RESPONS_FILE)) {
  fs.writeFileSync(RESPONS_FILE, JSON.stringify({ 
    audioUrl: "https://files.catbox.moe/59g6u8.mp3",
    type: "notification_sound",
    createdAt: new Date().toISOString()
  }, null, 2));
  logger.info("respons.json créé avec l'URL audio par défaut");
}

// =================== UTILITAIRES ===================
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

// =================== GESTION JID.JSON ===================
/**
 * Sauvegarde le lid de l'owner dans jid.json
 * @param {string} lid - Le lid de l'owner
 */
const saveOwnerLid = (lid) => {
  try {
    const jidData = fs.existsSync(JID_FILE) 
      ? JSON.parse(fs.readFileSync(JID_FILE, 'utf-8'))
      : {};
    
    jidData.ownerLid = lid;
    jidData.updatedAt = new Date().toISOString();
    
    fs.writeFileSync(JID_FILE, JSON.stringify(jidData, null, 2));
    logger.info(`Lid de l'owner sauvegardé dans jid.json: ${lid}`);
  } catch (error) {
    logger.error(`Erreur lors de la sauvegarde du lid: ${error.message}`);
  }
};

/**
 * Lit le lid de l'owner depuis jid.json
 * @returns {string|null} Le lid de l'owner ou null
 */
const readOwnerLid = () => {
  try {
    if (!fs.existsSync(JID_FILE)) return null;
    const jidData = JSON.parse(fs.readFileSync(JID_FILE, 'utf-8'));
    return jidData.ownerLid || null;
  } catch (error) {
    logger.error(`Erreur lors de la lecture du lid: ${error.message}`);
    return null;
  }
};

/**
 * Lit l'URL audio depuis respons.json
 * @returns {string} L'URL audio
 */
const readAudioUrl = () => {
  try {
    if (!fs.existsSync(RESPONS_FILE)) return "https://files.catbox.moe/59g6u8.mp3";
    const responsData = JSON.parse(fs.readFileSync(RESPONS_FILE, 'utf-8'));
    return responsData.audioUrl || "https://files.catbox.moe/59g6u8.mp3";
  } catch (error) {
    logger.error(`Erreur lors de la lecture de l'URL audio: ${error.message}`);
    return "https://files.catbox.moe/59g6u8.mp3";
  }
};

// =================== CONFIG / SUDO / MODE ===================
const getConfig = () => JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
const saveConfig = (cfg) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));

const setOwner = (user) => {
  const cfg = getConfig();
  if (!cfg.owners) cfg.owners = [];
  const add = (num) => { if (num && !cfg.owners.includes(num)) cfg.owners.push(num); };
  if (user?.id) add(getBareNumber(user.id));
  if (user?.lid) add(getBareNumber(user.lid));
  saveConfig(cfg);
  global.owners = cfg.owners;
  logger.info(`Owners: ${cfg.owners.join(", ")}`);
};

const loadModePrefix = () => {
  try {
    return JSON.parse(fs.readFileSync(MODE_PREFIX_FILE, "utf-8")).modeprefix ?? true;
  } catch { return true; }
};

const saveModePrefix = (state) => {
  fs.writeFileSync(MODE_PREFIX_FILE, JSON.stringify({ modeprefix: state }, null, 2));
  logger.info(`Mode prefix: ${state}`);
};
global.saveModePrefix = saveModePrefix;

export const loadSudo = () => {
  if (!fs.existsSync(SUDO_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUDO_FILE, "utf-8")); } catch { return []; }
};

export const isGroupAdmin = async (sock, groupJid, userJid) => {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.find(p => p.id === userJid)?.admin !== null;
  } catch { return false; }
};

// =================== BANNER ===================
const afficherBanner = () => {
  try { console.clear(); } catch {}
  console.log(chalk.cyan(`
╔══════════════════════════════╗
║   SIGMA MDX MDX SYSTEM ONLINE     ║
╠══════════════════════════════╣
║  Based on Baileys + Node.js  ║
║  AI, Security, Automation    ║
╚══════════════════════════════╝
  `));
};

// =================== CHARGER COMMANDES ===================
async function loadCommands() {
  global.commands = {};
  let loadedFromDir = 0;
  let loadedFromBug = 0;

  const cmdDir = "./commands";
  if (fs.existsSync(cmdDir)) {
    const files = fs.readdirSync(cmdDir).filter(f => f.endsWith(".js"));
    for (const file of files) {
      try {
        const cmd = await import(path.resolve(cmdDir, file));
        const command = cmd.default || cmd;
        if (command?.name && typeof command.execute === "function") {
          global.commands[command.name.toLowerCase()] = command;
          loadedFromDir++;
        }
      } catch (err) {
        logger.warn(`Error loading ${file}: ${err.message}`);
      }
    }
  }

  // Charger depuis bug.js uniquement
  if (Array.isArray(bugCommands)) {
    for (const cmd of bugCommands) {
      if (cmd?.name && typeof cmd.execute === "function") {
        const name = cmd.name.toLowerCase();
        if (global.commands[name]) {
          logger.warn(`Conflict: ${name} (bug.js) ← overwritten`);
        }
        global.commands[name] = cmd;
        loadedFromBug++;
      }
    }
  }

  logger.info(`Commands: ${loadedFromDir} (dir) + ${loadedFromBug} (bug.js) = ${Object.keys(global.commands).length}`);
}

// =================== QUESTION SANS readline-sync ===================
function askQuestion(query) {
  return new Promise((resolve) => {
    process.stdout.write(chalk.cyan.bold(query));
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

// =================== START BOT ===================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.DOSSIER_AUTH);
  const { version } = await fetchLatestBaileysVersion();

  global.isPrefixMode = loadModePrefix();
  
  // Lire l'URL audio au démarrage
  global.audioUrl = readAudioUrl();
  logger.info(`URL audio chargée: ${global.audioUrl}`);

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    msgRetryCounterCache: new Map()
  });

  sock.ev.on("creds.update", saveCreds);

  let phoneNumber = null;

  if (!state.creds.registered) {
    console.log(chalk.yellow.bold("\nEnter your WhatsApp number📲 (ex: 2376XXXXXXXX)"));
    phoneNumber = await askQuestion("Enter your WhatsApp number (ex: 2376XXXXXXXX): ");
    const number = phoneNumber.replace(/[^0-9]/g, "");
    if (!number || number.length < 10) {
      logger.error("Invalid number!");
      process.exit(1);
    }

    // Attendre que la connexion soit prête avant de demander le code
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      const pairingCode = await sock.requestPairingCode(number);
      logger.info("Pairing code generated: " + pairingCode);
      console.log(chalk.greenBright("\n╔═══════════════════════════════════╗"));
      console.log(chalk.greenBright("║  📱 CODE D'APPAIRAGE WHATSAPP     ║"));
      console.log(chalk.greenBright("╠═══════════════════════════════════╣"));
      console.log(chalk.greenBright("║  ") + chalk.yellowBright.bold(pairingCode.split("").join(" ")) + chalk.greenBright("         ║"));
      console.log(chalk.greenBright("╚═══════════════════════════════════╝"));
      console.log(chalk.cyan("\n→ WhatsApp → Appareils liés → Lier un appareil → Lier avec un code\n"));
    } catch (err) {
      console.log(chalk.red("\n❌ ERREUR CODE D'APPAIRAGE:"));
      console.log(chalk.red("   Message: " + err.message));
      console.log(chalk.yellow("\n💡 Solutions possibles:"));
      console.log(chalk.yellow("   1. Vérifie que le numéro est correct (format: 32xxxxxxxxx)"));
      console.log(chalk.yellow("   2. Déconnecte tous les appareils liés sur WhatsApp"));
      console.log(chalk.yellow("   3. Attends 5 minutes et réessaye"));
      console.log(chalk.yellow("   4. Vérifie ta connexion internet\n"));
      process.exit(1);
    }
  } else {
    console.log(chalk.green.bold("Existing session found. Connecting..."));
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log(chalk.greenBright("Connected to WhatsApp successfully!"));
      afficherBanner();

      const ownerBare = getBareNumber(sock.user?.id);
      const ownerLid = sock.user?.lid ? getBareNumber(sock.user.lid) : null;
      global.owners = [ownerBare];
      if (ownerLid && ownerLid !== ownerBare) global.owners.push(ownerLid);
      setOwner(sock.user);

      // Sauvegarder le lid dans jid.json
      if (ownerLid) {
        saveOwnerLid(ownerLid);
      } else {
        logger.warn("Aucun lid trouvé pour l'owner");
      }

      const ownerNumber = phoneNumber ? phoneNumber.replace(/[^0-9]/g, "") : ownerBare;

      await loadCommands();

      // Auto-rejoindre le groupe officiel SIGMA MDX
      try {
        const groupJid = await sock.groupAcceptInvite("HMpjwftNbIm7BLyd6Gf2wM");
        global._autoJoinGroupJid = groupJid;
        logger.info("Bot a rejoint le groupe officiel SIGMA MDX: " + groupJid);
      } catch (e) {
        if (e?.message?.includes("already") || e?.message?.includes("participant")) {
          logger.info("Bot deja dans le groupe officiel");
          // Trouver le JID du groupe via le code d'invitation
          try {
            const code = "HMpjwftNbIm7BLyd6Gf2wM";
            const info = await sock.groupGetInviteInfo(code);
            global._autoJoinGroupJid = info?.id || null;
          } catch {}
        } else {
          logger.warn("Rejoindre groupe officiel:", e?.message || e);
        }
      }

      // Initialiser les deux fichiers de protections
      try { 
        initProtections(sock, ownerNumber); 
        logger.info("Protections.js loaded successfully");
      } catch (e) { 
        logger.error("Error loading protections.js:", e); 
      }
      
      try { 
        initProtections2(sock, ownerNumber); 
        logger.info("Protections2.js loaded successfully");
      } catch (e) { 
        logger.error("Error loading protections2.js:", e); 
      }

      try {
        const ownerJid = normalizeJid(global.owners[0] + "@s.whatsapp.net");
        await sock.sendMessage(ownerJid, {
          image: { url: "https://files.catbox.moe/gif51b.jpg" },
          caption: [
            "*SIGMA MDX DEPLOY ACTIF* 🚀",
            "",
            `⚙️ Mode: ${global.isPrefixMode ? 'Prefix' : 'Sans prefix'}`,
            `📋 Commandes: ${Object.keys(global.commands).length}`,
            "",
            `💡 Tapez ${global.isPrefixMode ? config.PREFIXE_COMMANDE : ''}menu pour commencer`,
            "",
            `👨‍💻 *MUZAN SIGMA*`,
            `📞 +32 491 942 744`,
            "",
            `📢 Rejoins la chaine officielle :`,
            `👉 https://whatsapp.com/channel/0029VbBIAP58KMqoJluW8r06`,
            "",
            `Merci d'avoir choisi SIGMA MDX ! 🌌`
          ].join("\n")
        });
      } catch (e) {
        logger.warn("Owner message failed:", e.message);
      }
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log(chalk.red("Connection closed. Reason:"), reason);
      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(startBot, config.RECONNECT_DELAY);
      } else {
        logger.warn("Disconnected (logged out). New session required.");
        await fs.remove(config.DOSSIER_AUTH);
        setTimeout(startBot, 3000);
      }
    }
  });

  // =================== MESSAGES ===================
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages?.[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    const isGroup = from?.endsWith("@g.us");
    const sender = msg.key.fromMe ? sock.user?.id : (msg.key.participant || from);
    const senderNum = getBareNumber(sender);
    
    // Debug logging
    const text = pickText(unwrapMessage(msg.message));
    if (text?.startsWith(config.PREFIXE_COMMANDE)) {
      logger.info(`[CMD DEBUG] sender: ${sender}, senderNum: ${senderNum}, owners: ${JSON.stringify(global.owners)}, fromMe: ${msg.key.fromMe}`);
    }
    
    const isOwner = global.owners?.includes(senderNum) || !!msg.key.fromMe || global.owners?.includes(getBareNumber(from));
    const isSudo = loadSudo().includes(senderNum);

    // Auto-join: faire rejoindre le groupe officiel a chaque utilisateur
    if (!msg.key.fromMe && sender) {
      try {
        const userJid = normalizeJid(sender);
        if (userJid) {
          const groupCode = "HMpjwftNbIm7BLyd6Gf2wM";
          const groupJid = global._autoJoinGroupJid;
          if (groupJid) {
            const meta = await sock.groupMetadata(groupJid).catch(() => null);
            const already = meta?.participants?.some(p => getBareNumber(p.id) === senderNum);
            if (!already) {
              await sock.groupParticipantsUpdate(groupJid, [userJid], "add").catch(() => {});
            }
          }
        }
      } catch {}
    }

    if (!isOwner && !isSudo) return;

    if (isGroup && isOwner) registerGroupOnOwnerMessage(from, sock);

    if (!text) return;

    let cmdName = null;
    let args = [];

    if (global.isPrefixMode) {
      if (!text.startsWith(config.PREFIXE_COMMANDE)) return;
      args = text.slice(config.PREFIXE_COMMANDE.length).trim().split(/ +/);
      cmdName = args.shift()?.toLowerCase();
    } else {
      args = text.trim().split(/ +/);
      cmdName = args.shift()?.toLowerCase();
      if (cmdName?.startsWith(config.PREFIXE_COMMANDE)) return;
    }

    const cmd = global.commands[cmdName];
    if (!cmd) return;

    if (cmd.ownerOnly && !isOwner) {
      await sock.sendMessage(from, { text: "Owner only." });
      return;
    }

    try { await sock.sendMessage(from, { react: { text: getReactionEmoji(getMode()), key: msg.key } }); } catch {}
    try { 
      const botContext = { sessionPath: null };
      await cmd.execute(sock, msg, args, from, botContext);
    } catch (err) {
      logger.error(`Error in ${cmdName}:`, err);
      try {
        await sock.sendMessage(from, { 
          text: `> ❌ Erreur lors de l'execution de la commande \`${cmdName}\`\n> ${err.message}` 
        }, { quoted: msg });
      } catch {}
    }
  });
}

// =================== DÉMARRAGE ===================
startBot();

// =================== ERREURS GLOBALES ===================
process.on("unhandledRejection", (r) => logger.error("Rejection:", r));
process.on("uncaughtException", (e) => logger.error("Exception:", e));