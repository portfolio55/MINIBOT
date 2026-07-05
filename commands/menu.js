import { getMode } from "./mode.js";
import { getBotMode } from "../src/utils/botMode.js";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

export const name = "menu";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Médias pour chaque mode (images, gifs et vidéos)
const BOY_MEDIA = [
  "https://files.catbox.moe/bld2md.jpeg",
  "https://files.catbox.moe/lgfdw9.jpeg",
  "https://files.catbox.moe/sbjiak.jpeg",
  "https://files.catbox.moe/hajb8e.jpeg",
  "https://files.catbox.moe/27pkgd.jpeg",
  "https://files.catbox.moe/e7zz9w.jpeg",
  "https://files.catbox.moe/tusxcv.jpeg",
  "https://files.catbox.moe/j91nis.jpeg",
  "https://files.catbox.moe/q1761g.jpeg",
  "https://files.catbox.moe/2y9cv0.jpeg",
  "https://files.catbox.moe/d8sbke.gif",
  "https://files.catbox.moe/9rfw38.mov",
  "https://files.catbox.moe/j00rij.mov"
];

const GIRL_MEDIA = [
  "https://files.catbox.moe/fe4cax.jpeg",
  "https://files.catbox.moe/bryi3h.jpeg",
  "https://files.catbox.moe/iss7tf.jpeg",
  "https://files.catbox.moe/y1ux96.mp4",
  "https://files.catbox.moe/zfnd0i.mp4",
  "https://files.catbox.moe/rwacqr.jpeg",
  "https://files.catbox.moe/ooy38i.jpeg",
  "https://files.catbox.moe/fpvbzu.jpeg",
  "https://files.catbox.moe/1go46s.jpeg",
  "https://files.catbox.moe/68ueou.jpeg",
  "https://files.catbox.moe/9uultv.jpeg",
  "https://files.catbox.moe/rrpz1x.jpeg",
  "https://files.catbox.moe/ff3158.jpeg",
  "https://files.catbox.moe/kpt5nb.jpeg",
  "https://files.catbox.moe/pwjnjp.gif",
  "https://files.catbox.moe/are1z9.jpeg",
  "https://files.catbox.moe/e9oz7c.jpeg",
  "https://files.catbox.moe/6mlzl6.jpeg"
];

const getMediaType = (url) => {
  const ext = String(url).split(".").pop().toLowerCase();
  if (ext === "mp4" || ext === "mov") return "video";
  if (ext === "gif") return "gif";
  return "image";
};

const getRandomMedia = (mode) => {
  const list = mode === "girl" ? GIRL_MEDIA : BOY_MEDIA;
  const url = list[Math.floor(Math.random() * list.length)];
  return { url, type: getMediaType(url) };
};

const loadBranding = async (sessionPath) => {
  try {
    if (!sessionPath) return {};
    const file = path.join(sessionPath, "branding.json");
    if (!(await fs.pathExists(file))) return {};
    const data = await fs.readJSON(file);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
};

const loadPrefix = async (sessionPath) => {
  try {
    if (!sessionPath) return "!";
    const file = path.join(sessionPath, "prefix.json");
    if (!(await fs.pathExists(file))) return "!";
    const data = await fs.readJSON(file);
    return (data?.prefix ?? "!") || "!";
  } catch {
    return "!";
  }
};

const section = (title, items) => {
  const list = (items || []).map((x) => `┃◈┃• ${x}`).join("\n");
  return [
    `╭━━〔 *${title}* 〕━━┈⊷`,
    "┃◈╭─────────────·๏",
    list || "┃◈┃• (vide)",
    "┃◈└───────────┈⊷",
    "╰──────────────┈⊷"
  ].join("\n");
};

// [MENU GIRL] Section au style "fleurs" — arrondi, doux, différent du style boy.
const sectionGirl = (title, items) => {
  const list = (items || []).map((x) => `│ ⊹ ${x}`).join("\n");
  return [
    `┌─❀ *${title}* ❀─┐`,
    list || "│ ⊹ (vide)",
    "└" + "─".repeat(Math.max(18, title.length + 4)) + "┘"
  ].join("\n");
};

const normalizeCommandModule = (mod) => {
  const raw = mod?.default ?? mod;
  if (!raw || typeof raw !== "object") return null;
  if (raw?.name && typeof raw.execute === "function") return raw;
  if (mod?.name && typeof mod.execute === "function") {
    return {
      name: mod.name,
      execute: mod.execute,
      description: mod.description,
      category: mod.category,
      ownerOnly: mod.ownerOnly
    };
  }
  return null;
};

const MANUAL_CATEGORIES = [
  {
    key: "download",
    title: "Download Menu",
    names: ["play", "son", "youtube", "tiktok", "instagram", "apk", "itunes", "podcast", "down-url", "url", "lyrics", "lyrics2", "lyrictts"]
  },
  {
    key: "converter",
    title: "Converter Menu",
    names: ["sticker", "photo", "tts", "tomp4", "tomp3", "vv", "vv2", "take", "img", "static-stick", "telegram-stick"]
  },
  {
    key: "ai",
    title: "AI Menu",
    names: ["ai", "openai", "deepseek", "imagine", "k-video", "sigmachat", "sigmachat-ib", "sigmavoice", "SIGMA MDX", "SIGMA MDXts"]
  },
  {
    key: "tools",
    title: "Tools Menu",
    names: [
      "calc", "translate", "meteo", "ping", "alive", "qr", "ssweb", "glow",
      "fancy", "time", "news", "fact", "definition", "dico", "langcode",
      "countryinfos", "horoscope", "quote", "animequote", "styletext",
      "textmaker", "textpro", "logo", "whois", "device", "infos", "save"
    ]
  },
  {
    key: "search",
    title: "Search Menu",
    names: ["anime", "manga", "film", "artist", "car", "muscu", "cours", "soulmate", "hentai", "game"]
  },
  {
    key: "group",
    title: "Group Menu",
    names: [
      "add", "kick", "kickall", "promote", "promoteall", "demote", "demoteall",
      "tagall", "hidetag", "tag", "tagadmin", "welcome", "goodbye",
      "removeadmins", "removeall2", "delmsgs", "revoke", "gclink",
      "ginfo", "infosgroups", "lockgc", "unlockgc", "mute", "unmute",
      "mute-time", "purge", "setgname", "setgdesc", "setppg", "settimeg",
      "gpass", "listonline", "alertadmin", "warn", "warnings", "resetwarn"
    ]
  },
  {
    key: "protection",
    title: "Protection Menu",
    names: [
      "antilink", "antibot", "antisticker", "antivideo", "antiaudio",
      "antimessage", "antipromote", "autoblock", "autoreact", "autovv",
      "protectionstate", "antiflood", "antiword", "addword", "delword",
      "listwords", "antidelete"
    ]
  },
  {
    key: "owner",
    title: "Owner/Sudo Menu",
    names: [
      "owner", "setsudo", "delsudo", "listsudo", "setbrand", "setprefix",
      "prefix", "mode", "setpp", "block", "unblock", "join", "left",
      "delete", "lid", "audiorespons", "respons", "setrespons",
      "baiseall", "writetoall", "principal", "wasted"
    ]
  },
  {
    key: "bug",
    title: "Bug Menu",
    names: ["bugmenu", "travas", "pending", "ghost", "brutal", "extend"]
  }
];

const loadAllCommands = async () => {
  const sourcesByName = new Map();
  const commandsByName = new Map();
  const add = (name, source) => {
    const key = String(name || "").toLowerCase();
    if (!key) return;
    if (!sourcesByName.has(key)) sourcesByName.set(key, []);
    sourcesByName.get(key).push(source);
  };

  const addCmd = (cmd, source) => {
    if (!cmd?.name) return;
    const key = String(cmd.name).toLowerCase();
    add(key, source);
    if (!commandsByName.has(key)) {
      commandsByName.set(key, {
        name: cmd.name,
        description: cmd.description,
        category: cmd.category,
        ownerOnly: cmd.ownerOnly,
        source
      });
    }
  };

  // commands/
  try {
    const cmdDir = path.join(__dirname);
    const files = (await fs.readdir(cmdDir)).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      if (file.toLowerCase() === "menu.js") continue;
      try {
        const cmdPath = path.resolve(cmdDir, file);
        const mod = await import(pathToFileURL(cmdPath).href);
        const cmd = normalizeCommandModule(mod);
        if (cmd?.name) addCmd(cmd, `commands/${file}`);
      } catch {
        // ignore import errors in menu listing
      }
    }
  } catch {
    // ignore
  }

  // bug.js
  try {
    const bugModule = await import(path.join(__dirname, "..", "bug.js"));
    const bugCommands = bugModule.default || [];
    for (const cmd of bugCommands) {
      if (cmd?.name) addCmd(cmd, "bug.js");
    }
  } catch {
    // ignore
  }

  const all = [...sourcesByName.keys()].sort((a, b) => a.localeCompare(b));
  const duplicates = all.filter((n) => (sourcesByName.get(n) || []).length > 1);

  return {
    all,
    commandsByName,
    duplicates,
    sourcesByName
  };
};

export async function execute(sock, msg, args, from, botContext) {
  try {
    const currentMode = botContext?.sessionPath ? await getBotMode(botContext.sessionPath) : getMode();
    const modeEmoji = currentMode === "girl" ? "🦋" : "🐸";
    const modeLabel = currentMode === "girl" ? "GIRL" : "BOY";

    const branding = await loadBranding(botContext?.sessionPath);
    const brandName = branding?.name || "";
    const brandPhone = branding?.phone || "";
    const brandChannel = branding?.channelLink || "";
    const brandDesc = branding?.description || "";
    const brandInstagram = branding?.instagram || "";

    const prefix = await loadPrefix(botContext?.sessionPath);
    
    // Uptime du bot
    const totalSeconds = process.uptime();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const uptime = `${hours}h ${minutes}m ${seconds}s`;
    
    const botName = branding?.botName || "SIGMA MDX";
    const ownerName = brandName || "Owner";
    const userName = msg.pushName || "Invité";
    const platform = os.platform();

    const headerIcon = currentMode === "girl" ? "🎀" : "⚡";
    const isGirl = currentMode === "girl";

    // [MENU GIRL] Header au style "fleurs" — bordures arrondies, séparateur étoilé,
    // distinct du header "gamer" utilisé en mode boy.
    const header = isGirl ? [
      `╭─❀• 🎀 *${botName}* 🎀 •❀─╮`,
      "│",
      `│  ✨ Owner   : *${ownerName}*`,
      brandInstagram ? `│  📸 Insta   : *${brandInstagram}*` : null,
      `│  💖 User    : *${userName}*`,
      `│  🦋 Mode    : *${modeLabel}*`,
      `│  🌐 Type    : *NodeJs*`,
      `│  💻 Platform: *${platform}*`,
      `│  🔖 Prefix  : [${prefix}]`,
      `│  🏷️ Version : *3.1.0*`,
      "│",
      "╰─────────────────────╯",
      "",
      `  ⋆｡‧˚ʚ ${headerIcon} Coucou *${userName}* ɞ˚‧｡⋆`,
      brandDesc ? `  📝 ${brandDesc}` : null,
      brandPhone ? `  📞 ${brandPhone}` : null,
      brandChannel ? `  📢 ${brandChannel}` : null
    ].filter(Boolean).join("\n") : [
      `╭━━━〔 *${botName}* 〕━━━┈⊷`,
      "┃★╭──────────────",
      `┃★│ Owner : *${ownerName}*`,
      brandInstagram ? `┃★│ Instagram : *${brandInstagram}*` : null,
      `┃★│ User : *${userName}*`,
      "┃★│ Baileys : *Multi Device*",
      "┃★│ Type : *NodeJs*",
      `┃★│ Mode : *${modeEmoji} ${modeLabel}*`,
      `┃★│ Platform : *${platform}*`,
      `┃★│ Prefix : [${prefix}]`,
      "┃★│ Version : *3.1.0*",
      "┃★╰──────────────",
      "╰━━━━━━━━━━━━━━━┈⊷",
      "",
      `> ${headerIcon} Yo *${userName}* !`,
      brandDesc ? `> 📝 ${brandDesc}` : null,
      brandPhone ? `> 📞 ${brandPhone}` : null,
      brandChannel ? `> 📢 ${brandChannel}` : null
    ].filter(Boolean).join("\n");

    const { all: allCommands, duplicates, sourcesByName, commandsByName } = await loadAllCommands();

    const remaining = new Set(allCommands.map((c) => String(c).toLowerCase()));
    const sections = [];
    const buildSection = isGirl ? sectionGirl : section;

    for (const cat of MANUAL_CATEGORIES) {
      const items = [];
      for (const n of cat.names) {
        const key = String(n).toLowerCase();
        if (remaining.has(key)) {
          items.push(n);
          remaining.delete(key);
        }
      }
      if (items.length > 0) sections.push(buildSection(cat.title, items));
    }

    const otherItems = [...remaining].sort((a, b) => a.localeCompare(b));
    if (otherItems.length > 0) {
      sections.push(buildSection("Other Menu", otherItems));
    }

    if (duplicates.length > 0) {
      const dupLines = duplicates.slice(0, 20).map((n) => {
        const srcs = (sourcesByName.get(n) || []).join(" | ");
        return `${n}  (${srcs})`;
      });
      sections.push(buildSection("Duplicates Detected", dupLines));
    }

    if (isGirl) {
      sections.push("  🌸 ⋆｡‧˚ Fin du menu ˚‧｡⋆ 🌸");
    }

    const text = [header, "", ...sections].join("\n\n");
    const menuMedia = getRandomMedia(currentMode);

    let mediaPayload;
    if (menuMedia.type === "video") {
      mediaPayload = { video: { url: menuMedia.url }, caption: text };
    } else if (menuMedia.type === "gif") {
      mediaPayload = { video: { url: menuMedia.url }, caption: text, gifPlayback: true };
    } else {
      mediaPayload = { image: { url: menuMedia.url }, caption: text };
    }

    // 1. Envoi du menu avec le média (image/gif/vidéo + texte du menu en légende)
    let menuSent = false;
    try {
      await Promise.race([
        sock.sendMessage(from, mediaPayload, { quoted: msg }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("MEDIA_TIMEOUT")), 20000)
        )
      ]);
      menuSent = true;
    } catch (mediaErr) {
      // Si le média échoue (timeout / réseau), envoyer le menu en texte uniquement
      console.warn("⚠️ Menu: média non chargé, envoi du menu en texte:", mediaErr.message);
      await sock.sendMessage(from, { text }, { quoted: msg });
      menuSent = true;
    }

    // 2. Envoi de l'audio du menu (toujours après l'image ou le texte)
    if (menuSent) {
      try {
        await Promise.race([
          sock.sendMessage(
            from,
            {
              audio: { url: "https://files.catbox.moe/02zeco.mp3" },
              mimetype: "audio/mpeg"
            },
            { quoted: msg }
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AUDIO_TIMEOUT")), 10000)
          )
        ]);
      } catch (audioErr) {
        console.warn("⚠️ Menu: audio non envoyé (timeout ou erreur réseau):", audioErr.message);
      }
    }

  } catch (err) {
    console.error("❌ Erreur commande menu :", err);
    try {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "> ❌ Impossible d'afficher le menu. Erreur: " + err.message },
        { quoted: msg }
      );
    } catch (sendErr) {
      console.error("❌ Erreur envoi message d'erreur :", sendErr);
    }
  }
}
