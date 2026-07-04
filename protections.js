import chalk from "chalk";
import axios from "axios";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { getGroupProtections, createGroupManager } from "./groupManager.js";
import gTTS from "node-gtts";
import fs from "fs";
import path from "path";

// =================== CONFIGURATION GÉNÉRALE ===================
export const CONFIG = {
  blockedLinks: ["chat.whatsapp.com", "bit.ly", "t.me", "tinyurl.com", "ouo.io", "shorte.st"],
  autoLikeInterval: 60_000,
  spam: { limit: 5, timeWindow: 3000, maxWarnings: 3 },
  cooldowns: { protectionToggle: 30000, commandUsage: 5000 }
};

// =================== 22 IMAGES ALÉATOIRES WELCOME & GOODBYE ===================
const WELCOME_IMAGES = [
  "https://files.catbox.moe/gif51b.jpg","https://files.catbox.moe/s0opn7.jpg","https://files.catbox.moe/lhpf7b.jpg",
  "https://files.catbox.moe/degxst.jpg","https://files.catbox.moe/weqqt6.jpg","https://files.catbox.moe/5j2ukc.jpg",
  "https://files.catbox.moe/2g94h4.jpg","https://files.catbox.moe/z7h6nj.jpg","https://files.catbox.moe/e945km.jpg",
  "https://files.catbox.moe/tdh6zq.jpg","https://files.catbox.moe/6uizvk.jpg","https://files.catbox.moe/m34aop.jpg",
  "https://files.catbox.moe/jwbrkr.jpg","https://files.catbox.moe/y7c9p5.jpg","https://files.catbox.moe/a33171.jpg",
  "https://files.catbox.moe/2zl7vk.jpg","https://files.catbox.moe/dnq77s.jpg","https://files.catbox.moe/312znf.jpg",
  "https://files.catbox.moe/5le1e7.jpg","https://files.catbox.moe/gpsy0t.jpg","https://files.catbox.moe/gif51b.jpg",
  "https://files.catbox.moe/s0opn7.jpg"
];

const getRandomImage = () => WELCOME_IMAGES[Math.floor(Math.random() * WELCOME_IMAGES.length)];

// =================== RÉACTIONS ===================
const REACTIONS = {
  antiMessage: "🚫",
  antiLink: "🔗",
  antiBot: "🤖",
  antiSticker: "🎨",
  antiVoice: "🔇",
  antiVideo: "📵",
  welcome: "👋",
  goodbye: "💔",
  antiPromote: "⛔",
  antiSpam: "🛡️"
};

const RANDOM_REACTIONS = ["👍","❤️","😂","😮","😢","🙏","🔥","🎉","💯","⚡","🌟","✨","💪"];

// =================== LOGGER ===================
class ProtectionLogger {
  static log(protection, action, user, group, details = {}) {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    const userInfo = user ? `User: ${getBareNumber(user)}` : 'System';
    const groupInfo = group ? `Group: ${getBareNumber(group)}` : 'Unknown';
    
    console.log(chalk.blue(`[${timestamp}] [${protection.padEnd(15)}] ${action}`));
    console.log(chalk.gray(`   ${userInfo} | ${groupInfo}`));
    if (Object.keys(details).length > 0) {
      console.log(chalk.gray(`   Details: ${JSON.stringify(details, null, 2)}`));
    }
  }
  
  static error(protection, error, context = {}) {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    console.error(chalk.red(`[${timestamp}] [${protection.padEnd(15)}] ERREUR:`), error.message || error);
    if (Object.keys(context).length > 0) {
      console.error(chalk.red(`   Contexte: ${JSON.stringify(context)}`));
    }
  }

  static warn(protection, message, context = {}) {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    console.warn(chalk.yellow(`[${timestamp}] [${protection.padEnd(15)}] AVERTISSEMENT: ${message}`));
    if (Object.keys(context).length > 0) {
      console.warn(chalk.yellow(`   ? ${JSON.stringify(context)}`));
    }
  }
}

// =================== GESTIONNAIRE D'ÉTAT ===================
class ProtectionManager {
  constructor(ownerNumber) {
    this.ownerNumber = ownerNumber?.replace(/[^0-9]/g, "");
    this.userCooldowns = new Map();
    this.spamTracker = new Map();
    this.whitelist = {
      users: new Set([this.ownerNumber]),
      groups: new Set(),
      links: new Set(['trusted-domain.com'])
    };
  }

  isWhitelisted(identifier, type = 'user') {
    const clean = identifier.replace(/[^0-9]/g, "");
    if (type === 'user') return this.whitelist.users.has(clean);
    if (type === 'group') return this.whitelist.groups.has(clean);
    return false;
  }

  getMessageContent(msg) {
    return msg.message?.conversation || 
           msg.message?.extendedTextMessage?.text || 
           msg.message?.imageMessage?.caption ||
           msg.message?.videoMessage?.caption ||
           msg.message?.documentMessage?.caption ||
           '';
  }
}

// Plus de variable module-level — chaque instance reçoit son propre manager via initProtections()

// =================== UTILITAIRES ===================
function getBareNumber(input) {
  if (!input) return "inconnu";
  return String(input).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

async function isBotAdmin(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    const botJid = sock.user?.id;
    if (!botJid) return false;
    return metadata.participants.some(p => p.id === botJid && p.admin);
  } catch (error) {
    ProtectionLogger.error('BOT_ADMIN_CHECK', error, { groupId });
    return false;
  }
}

async function shouldSkipProtection(sock, msg, manager) {
  const from = msg.key.remoteJid;
  if (!from.endsWith("@g.us")) return true;

  const sender = msg.key.participant || from;
  if (manager && manager.isWhitelisted(sender, 'user')) return true;

  try {
    const groupMetadata = await sock.groupMetadata(from);
    const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;
    const isOwner = manager ? getBareNumber(sender) === manager.ownerNumber : false;
    return isAdmin || isOwner || msg.key.fromMe;
  } catch {
    return false;
  }
}

// =================== AUTO-VV 2.0 ===================
export function autoVV(sock, getGP = getGroupProtections, manager = null) {
  const processedMessages = new Set();
  const botConfig = manager?._autoVVConfig || { ignoreAdmins: false, sendReaction: true };
  const botAutoVVIB = manager?._autoVVIB || { enabled: true };
  
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      const from = msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");
      const isDM = !isGroup && from.endsWith("@s.whatsapp.net");
      
      if (msg.key.fromMe) continue;

      const messageId = msg.key.id;
      if (processedMessages.has(messageId)) continue;
      processedMessages.add(messageId);
      setTimeout(() => processedMessages.delete(messageId), 60000);

      const viewOnceMessage = 
        msg.message?.viewOnceMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message?.viewOnceMessageV2Extension?.message;

      if (!viewOnceMessage) continue;

      let shouldProcess = false;
      if (isGroup) {
        const groupProtections = getGP(from);
        if (groupProtections?.autoVV || groupProtections?.autoVV2) shouldProcess = true;
      } else if (isDM) {
        shouldProcess = botAutoVVIB.enabled !== false;
      }
      
      if (!shouldProcess) continue;

      const sender = msg.key.participant || from;
      if (manager && manager.isWhitelisted(sender, 'user')) continue;
      if (manager && getBareNumber(sender) === manager.ownerNumber) continue;

      if (botConfig.ignoreAdmins) {
        try {
          const metadata = await sock.groupMetadata(from);
          const isAdmin = metadata.participants.find(p => p.id === sender)?.admin;
          if (isAdmin) continue;
        } catch {}
      }

      ProtectionLogger.log('AUTO-VV', 'Vue unique détectée ? récupération', sender, from);

      try {
        const innerMsg = viewOnceMessage.viewOnceMessageV2?.message ||
                         viewOnceMessage.viewOnceMessageV2Extension?.message ||
                         viewOnceMessage;

        let buffer = Buffer.from([]);
        let mediaType = null;
        let options = {};

        if (innerMsg.imageMessage) {
          mediaType = "image";
          const stream = await downloadContentFromMessage(innerMsg.imageMessage, "image");
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          options = { caption: "> SIGMA MDX DEPLOY : ?? Vue unique récupérée", mimetype: innerMsg.imageMessage.mimetype || "image/jpeg" };
        } else if (innerMsg.videoMessage) {
          mediaType = "video";
          const stream = await downloadContentFromMessage(innerMsg.videoMessage, "video");
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          options = { caption: "> SIGMA MDX DEPLOY : ?? Vue unique récupérée", mimetype: innerMsg.videoMessage.mimetype || "video/mp4", gifPlayback: innerMsg.videoMessage.gifPlayback || false };
        } else if (innerMsg.audioMessage) {
          mediaType = "audio";
          const stream = await downloadContentFromMessage(innerMsg.audioMessage, "audio");
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          options = { mimetype: innerMsg.audioMessage.mimetype || "audio/ogg; codecs=opus", ptt: innerMsg.audioMessage.ptt || false };
        } else if (innerMsg.stickerMessage) {
          mediaType = "sticker";
          const stream = await downloadContentFromMessage(innerMsg.stickerMessage, "sticker");
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          options = {};
        } else if (innerMsg.documentMessage) {
          mediaType = "document";
          const stream = await downloadContentFromMessage(innerMsg.documentMessage, "document");
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          options = { fileName: innerMsg.documentMessage.fileName || "document", mimetype: innerMsg.documentMessage.mimetype || "application/octet-stream" };
        } else {
          await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY : ?? Vue unique détectée\nType non supporté` });
          continue;
        }

        if (buffer.length > 0) {
          const caption = options.caption 
            ? `\( {options.caption}\n\n?? De : @ \){getBareNumber(sender)}`
            : `⚡ De : @${getBareNumber(sender)}`;

          await sock.sendMessage(from, { [mediaType]: buffer, ...options, caption }, { quoted: msg });
          
          if (botConfig.sendReaction !== false) {
            await sock.sendMessage(from, { react: { text: "⚡ 🎨 ⚡", key: msg.key } }).catch(() => {});
          }
          
          ProtectionLogger.log('AUTO-VV', `Média ${mediaType} récupéré`, sender, from, { size: buffer.length });
        }

      } catch (error) {
        ProtectionLogger.error('AUTO-VV', error, { from, sender: getBareNumber(sender) });
      }
    }
  });
}


// =================== ANTI-PROMOTE1 ===================
export function antipromote1(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("group-participants.update", async (update) => {
    const { id: groupId, action, participants, actor } = update;

    if (action !== "promote") return;

    const groupProtections = getGP(groupId);
    if (!groupProtections?.antipromote1) return;

    const botIsAdmin = await isBotAdmin(sock, groupId);
    if (!botIsAdmin) {
      ProtectionLogger.warn('ANTIPROMOTE1', 'Bot non admin ? impossible de démoter', null, groupId);
      return;
    }

    try {
      const metadata = await sock.groupMetadata(groupId);
      const groupName = metadata.subject || "Groupe inconnu";
      const time = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Algiers" });

      const promotedUser = participants[0];
      const promoter = actor;

      if (!promotedUser || !promoter) return;

      const promotedNum = getBareNumber(promotedUser);
      const promoterNum = getBareNumber(promoter);

      if (manager && (manager.isWhitelisted(promotedUser, 'user') || manager.isWhitelisted(promoter, 'user'))) return;
      if (promoter === sock.user?.id) return;

      const toDemote = [];
      if (promotedUser) toDemote.push(promotedUser);
      if (promoter && promoter !== promotedUser) toDemote.push(promoter);

      if (toDemote.length > 0) {
        await sock.groupParticipantsUpdate(groupId, toDemote, "demote");

        const alertText = `
?? *ANTI-PROMOTE ACTIVÉ* ??

?? Tentative de promotion : @${promotedNum}
?? Par : @${promoterNum}
?? Action bloquée !

?? Les deux ont été rétrogradés automatiquement.

👥 Groupe : ${groupName}
?? ${time}`;

        await sock.sendMessage(groupId, { text: alertText, mentions: [promotedUser, promoter].filter(Boolean) });

        const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
        if (admins.length > 0) {
          await sock.sendMessage(groupId, { text: "?".repeat(200), mentions: admins }).catch(() => {});
        }

        ProtectionLogger.log('ANTIPROMOTE1', `Promotion bloquée ? démotion de @\( {promotedNum} et @ \){promoterNum}`, promoter, groupId);

        const ownerNumber = manager?.ownerNumber;
        if (ownerNumber) {
          const ownerJid = ownerNumber + "@s.whatsapp.net";
          await sock.sendMessage(ownerJid, {
            text: `⚡ *ANTI-PROMOTE DÉCLENCHÉ*\n\n👤 @\( {promotedNum}\n?? Par : @ \){promoterNum}\n?? \( {groupName}\n?? \){time}\n\n?? Démotés automatiquement.`,
            mentions: [promotedUser, promoter].filter(Boolean)
          }).catch(() => {});
        }
      }
    } catch (error) {
      ProtectionLogger.error('ANTIPROMOTE1', error, { groupId });
    }
  });
}

// =================== ANTI-MESSAGE ===================
export function antiMessage(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.antiMessage) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const sender = msg.key.participant || from;
      const text = manager ? manager.getMessageContent(msg) : (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text.trim()) continue;

      try {
        await sock.sendMessage(from, { delete: msg.key });
        await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: Message texte supprimé ! @${getBareNumber(sender)}`, mentions: [sender] });
        await sock.sendMessage(from, { react: { text: REACTIONS.antiMessage, key: msg.key } });
        ProtectionLogger.log('ANTI-MESSAGE', 'Message texte supprimé', sender, from);
      } catch (error) {
        ProtectionLogger.error('ANTI-MESSAGE', error);
      }
    }
  });
}

// =================== ANTI-LINK ===================
export function antiLink(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.antiLink) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const sender = msg.key.participant || from;
      const text = manager ? manager.getMessageContent(msg) : (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text) continue;

      const hasBlockedLink = CONFIG.blockedLinks.some(link => text.toLowerCase().includes(link));

      if (!hasBlockedLink) continue;

      try {
        await sock.sendMessage(from, { delete: msg.key });
        await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: Lien interdit détecté et supprimé ! @${getBareNumber(sender)}`, mentions: [sender] });
        await sock.sendMessage(from, { react: { text: REACTIONS.antiLink, key: msg.key } });
        ProtectionLogger.log('ANTI-LINK', 'Lien bloqué supprimé', sender, from, { snippet: text.slice(0, 50) });
      } catch (error) {
        ProtectionLogger.error('ANTI-LINK', error);
      }
    }
  });
}

// =================== ANTI-BOT ===================
export function antiBot(sock, getGP = getGroupProtections, manager = null) {
  const forbiddenStarters = [
    '.', '?', '!', ';', ':', "'", '"', '*', '^', '§', '?', '×', '÷', 'p', 'v',
    '•', '|', '`', '~', '%', '/', '-', '+', '=', '#', '@', '&', '(', ')', '[', ']',
    '{', '}', '<', '>', '\\', '±', '8', '°', '©', '®', '™', '¤', '¥', '€', '£'
  ];

  const processedKeys = new Set();

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      const msgId = msg.key.id;
      if (processedKeys.has(msgId)) continue;
      processedKeys.add(msgId);
      setTimeout(() => processedKeys.delete(msgId), 10_000);

      if (!msg.message) continue;

      const from = msg.key.remoteJid;
      if (!from?.endsWith("@g.us")) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.antiBot) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const sender = msg.key.participant || from;
      const text = (manager ? manager.getMessageContent(msg) : (msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''))?.trim();
      if (!text || text.length < 3) continue;

      const firstChar = text[0];
      if (!forbiddenStarters.includes(firstChar)) continue;

      try {
        await sock.sendMessage(from, { delete: msg.key });

        const botIsAdmin = await isBotAdmin(sock, from);
        if (botIsAdmin) {
          await sock.groupParticipantsUpdate(from, [sender], "remove");
        }

        await sock.sendMessage(from, {
          text: `> SIGMA MDX DEPLOY: 🤖 Bot détecté et neutralisé !\n\n@\( {getBareNumber(sender)} kické pour message automatisé.\nPréfixe détecté : \` \){firstChar}\``,
          mentions: [sender]
        });

        await sock.sendMessage(from, { react: { text: REACTIONS.antiBot, key: msg.key } });

        ProtectionLogger.log('ANTI-BOT', `Bot kické (préfixe: ${firstChar})`, sender, from);

      } catch (error) {
        ProtectionLogger.error('ANTI-BOT', error, { sender, group: from });
      }
    }
  });
}

// =================== ANTI-STICKER ===================
export function antiSticker(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message?.stickerMessage || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.antiSticker) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const sender = msg.key.participant || from;

      try {
        await sock.sendMessage(from, { delete: msg.key });
        await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: Sticker interdit ! @${getBareNumber(sender)}`, mentions: [sender] });
        await sock.sendMessage(from, { react: { text: REACTIONS.antiSticker, key: msg.key } });
        ProtectionLogger.log('ANTI-STICKER', 'Sticker supprimé', sender, from);
      } catch (error) {
        ProtectionLogger.error('ANTI-STICKER', error);
      }
    }
  });
}

// =================== ANTI-VOICE ===================
export function antiVoice(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message?.audioMessage || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.antiVoice) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const sender = msg.key.participant || from;

      try {
        await sock.sendMessage(from, { delete: msg.key });
        await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: Message vocal interdit ! @${getBareNumber(sender)}`, mentions: [sender] });
        await sock.sendMessage(from, { react: { text: REACTIONS.antiVoice, key: msg.key } });
        ProtectionLogger.log('ANTI-VOICE', 'Message vocal supprimé', sender, from);
      } catch (error) {
        ProtectionLogger.error('ANTI-VOICE', error);
      }
    }
  });
}

// =================== ANTI-VIDEO ===================
export function antiVideo(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message?.videoMessage || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.antiVideo) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const sender = msg.key.participant || from;

      try {
        await sock.sendMessage(from, { delete: msg.key });
        await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: Vidéo interdite ! @${getBareNumber(sender)}`, mentions: [sender] });
        await sock.sendMessage(from, { react: { text: REACTIONS.antiVideo, key: msg.key } });
        ProtectionLogger.log('ANTI-VIDEO', 'Vidéo supprimée', sender, from);
      } catch (error) {
        ProtectionLogger.error('ANTI-VIDEO', error);
      }
    }
  });
}

// =================== AUTO-REACT ===================
export function autoReact(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.autoReact) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const randomReact = RANDOM_REACTIONS[Math.floor(Math.random() * RANDOM_REACTIONS.length)];

      try {
        await sock.sendMessage(from, { react: { text: randomReact, key: msg.key } });
        ProtectionLogger.log('AUTO-REACT', `Réaction envoyée: ${randomReact}`, msg.key.participant, from);
      } catch (error) {
        ProtectionLogger.error('AUTO-REACT', error);
      }
    }
  });
}

// =================== ANTI-SPAM ===================
export function antiSpam(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.antiSpam) continue;

      if (await shouldSkipProtection(sock, msg, manager)) continue;

      const sender = msg.key.participant || from;
      const key = `\( {from}: \){sender}`;
      const now = Date.now();

      if (manager && !manager.spamTracker.has(key)) {
        manager.spamTracker.set(key, []);
      }

      const history = manager ? manager.spamTracker.get(key) : null;
      if (!history) continue;
      history.push(now);
      const recent = history.filter(t => now - t < CONFIG.spam.timeWindow);

      if (recent.length > CONFIG.spam.limit) {
        try {
          const botIsAdmin = await isBotAdmin(sock, from);
          if (botIsAdmin) {
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: ?? Spam détecté ! @${getBareNumber(sender)} a été kické.`, mentions: [sender] });
          } else {
            await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: Spam détecté (@${getBareNumber(sender)}), mais je ne suis pas admin.`, mentions: [sender] });
          }
          manager.spamTracker.delete(key);
          ProtectionLogger.log('ANTI-SPAM', 'Utilisateur kické pour spam', sender, from);
        } catch (error) {
          ProtectionLogger.error('ANTI-SPAM', error);
        }
      } else {
        manager.spamTracker.set(key, recent);
      }
    }
  });
}

// =================== AUTO-SIGMA-CHAT (TEXTE) ===================
export function autoSigmaChat(sock, getGP = getGroupProtections, manager = null) {
  const cooldownMap = new Map();
  const userCooldown = 5000;

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      
      const from = msg.key.remoteJid;
      if (!from.endsWith('@g.us')) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.autoSigmaChat) continue;

      const sender = msg.key.participant || from;
      const cooldownKey = `\( {from}: \){sender}`;
      const now = Date.now();
      
      if (cooldownMap.has(cooldownKey) && now - cooldownMap.get(cooldownKey) < userCooldown) continue;

      const text = manager ? manager.getMessageContent(msg) : (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      if (!text || text.trim().length < 3) continue;

      if (/^[\.\!\?\/\#\*\$\-\+\=]/.test(text)) continue;

      if (manager && manager.isWhitelisted(sender, 'user')) continue;
      if (manager && getBareNumber(sender) === manager.ownerNumber) continue;

      cooldownMap.set(cooldownKey, now);

      try {
        const apiUrl = `https://api.maherapi.my.id/ai/gemini?query=${encodeURIComponent(text)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.result) throw new Error("Pas de réponse");

        await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY:\n${data.result}` }, { quoted: msg });

        ProtectionLogger.log('AUTO-SIGMA-CHAT', 'Réponse texte envoyée', sender, from);

      } catch (error) {
        ProtectionLogger.error('AUTO-SIGMA-CHAT', error.message || error);
      }
    }
  });
}

// =================== SIGMA VOICE : IA + TTS AUTOMATIQUE (VOIX) - SANS MESSAGE D'ATTENTE ===================
export function sigmaVoice(sock, getGP = getGroupProtections, manager = null) {
  const cooldownMap = new Map();
  const userCooldown = 8000; // 8 secondes entre chaque réponse vocale
  const tts = gTTS("fr");
  const tempDir = "./temp";

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      if (!from.endsWith("@g.us")) continue;

      const groupProtections = getGP(from);
      if (!groupProtections?.sigmaVoice) continue;

      const sender = msg.key.participant || from;
      const cooldownKey = `\( {from}: \){sender}`;
      const now = Date.now();

      if (cooldownMap.has(cooldownKey) && now - cooldownMap.get(cooldownKey) < userCooldown) continue;

      const text = (manager ? manager.getMessageContent(msg) : (msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''))?.trim();
      if (!text || text.length < 3) continue;

      if (/^[\.\!\?\/\#\*\$\-\+\=]/.test(text)) continue;

      if (manager && manager.isWhitelisted(sender, 'user')) continue;
      if (manager && getBareNumber(sender) === manager.ownerNumber) continue;

      cooldownMap.set(cooldownKey, now);

      try {
        const apiUrl = `https://apis.davidcyriltech.my.id/ai/chatbot?query=${encodeURIComponent(text)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.success || !data.result || !data.result.trim()) {
          return; // Silence total si pas de réponse
        }

        const responseText = data.result.trim();
        const audioPath = path.join(tempDir, `sigma_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);

        await new Promise((resolve, reject) => {
          tts.save(audioPath, responseText, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        // Envoi direct de l'audio ? rien d'autre
        await sock.sendMessage(from, {
          audio: fs.readFileSync(audioPath),
          mimetype: "audio/mpeg",
          ptt: true
        }, { quoted: msg });

        // Nettoyage silencieux
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

        ProtectionLogger.log('SIGMA-VOICE', 'Réponse vocale envoyée (silencieuse)', sender, from, { chars: responseText.length });

      } catch (error) {
        ProtectionLogger.error('SIGMA-VOICE', error.message || error, { group: from, sender });
        // Rien envoyé à l'utilisateur ? mode 100% discret
      }
    }
  });
}

// =================== WELCOME (SANS HIDETAG) ===================
export function welcome(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("group-participants.update", async (update) => {
    const groupProtections = getGP(update.id);
    if (!groupProtections?.welcome || update.action !== "add") return;

    for (const participant of update.participants) {
      try {
        const metadata = await sock.groupMetadata(update.id);
        const memberCount = metadata.participants.length;
        const groupName = metadata.subject || "ce groupe";
        const randomImg = getRandomImage();

        await sock.sendMessage(update.id, {
          image: { url: randomImg },
          caption: 
`> 🎨🎨 ? SIGMA MDX-DEPLOY ? 🎨??
> ❌ 👤 @${getBareNumber(participant)} 
> ❌ 👋 Bienvenue dans *${groupName}* !
> ❌ 
> ❌ ?? Tu es le ${memberCount}? membre
> ❌ Présente-toi 
> 🎨🎨🎨 ? ? ? 🎨🎨? ⚡`,
          mentions: [participant]
        });

        ProtectionLogger.log('WELCOME', 'Nouveau membre accueilli', participant, update.id);

      } catch (error) {
        ProtectionLogger.error('WELCOME', error, { group: update.id, participant });
      }
    }
  });
}

// =================== GOODBYE (SANS HIDETAG) ===================
export function goodbye(sock, getGP = getGroupProtections, manager = null) {
  sock.ev.on("group-participants.update", async (update) => {
    const groupProtections = getGP(update.id);
    if (!groupProtections?.goodbye || update.action !== "remove") return;

    for (const participant of update.participants) {
      try {
        const metadata = await sock.groupMetadata(update.id);
        const memberCount = metadata.participants.length;
        const groupName = metadata.subject || "ce groupe";
        const randomImg = getRandomImage();

        const wasKicked = update.actor && update.actor !== participant;
        const actorNum = update.actor ? getBareNumber(update.actor) : null;

        const goodbyeText = wasKicked 
          ? `> 🎨🎨 ? SIGMA MDX-DEPLOY ? 🎨🎨
> ❌ 👤 @${getBareNumber(participant)} 
> ❌ ? Expulsé du groupe !
> ❌ 🎨? Par : @${actorNum}
> ❌ 👥 Membres restants : ${memberCount}
> 🎨🎨🎨 ? ? ? 🎨🎨 ⚡`
          : `> 🎨🎨? ? SIGMA MDX-DEPLOY ? 🎨🎨?
> ❌ 👤 @${getBareNumber(participant)} 
> ❌ ? A quitté le groupe
> ❌ 👥 Membres restants : ${memberCount}
> ❌ 
> ❌ ?? C'est toi qui perd !!!!
> 🎨🎨🎨 ? ? ? 🎨🎨? ⚡`;

        await sock.sendMessage(update.id, {
          image: { url: randomImg },
          caption: goodbyeText,
          mentions: wasKicked ? [participant, update.actor].filter(Boolean) : [participant]
        });

        ProtectionLogger.log('GOODBYE', wasKicked ? 'Expulsé' : 'A quitté', participant, update.id);

      } catch (error) {
        ProtectionLogger.error('GOODBYE', error, { group: update.id, participant });
      }
    }
  });
}

// =================== INIT PROTECTIONS ===================
export function initProtections(sock, ownerNumber, sessionPath, sharedGroupManager = null) {
  if (!ownerNumber) {
    ProtectionLogger.error('INIT', 'ownerNumber manquant !');
    return null;
  }

  const manager = new ProtectionManager(ownerNumber);
  manager._autoVVIB = { enabled: true };
  manager._autoVVConfig = { ignoreAdmins: false, sendReaction: true };

  // Utilise le groupManager partagé du bot (même cache que les commandes .welcome, .antilink, etc.)
  // pour éviter que les toggles écrits par les commandes ne soient invisibles aux listeners d'événements.
  const _gm = sharedGroupManager || createGroupManager(sessionPath);
  const _getGP = _gm.getGroupProtections;

  const availableProtections = [
    antiMessage,
    antiLink,
    antiBot,
    antiSticker,
    antiVoice,
    antiVideo,
    autoReact,
    autoVV,
    welcome,
    goodbye,
    antiSpam,
    autoSigmaChat,
    sigmaVoice,
    antipromote1
  ];

  ProtectionLogger.log('SYSTÈME', 'Démarrage des protections...');

  availableProtections.forEach(protection => {
    protection(sock, _getGP, manager);
    ProtectionLogger.log('SYSTÈME', `${protection.name.toUpperCase()} activée ?`);
  });

  ProtectionLogger.log('SYSTÈME', 'Toutes les protections sont ACTIVES ?');
  return manager;
}
