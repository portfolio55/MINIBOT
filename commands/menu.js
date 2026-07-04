import { getMode } from "./mode.js";
import { getBotMode } from "../src/utils/botMode.js";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

export const name = "menu";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Images pour chaque mode
const GIRL_IMAGES = [
  "https://files.catbox.moe/gif51b.jpg",
  "https://files.catbox.moe/s0opn7.jpg",
  "https://files.catbox.moe/lhpf7b.jpg",
  "https://files.catbox.moe/degxst.jpg",
  "https://files.catbox.moe/weqqt6.jpg",
  "https://files.catbox.moe/5j2ukc.jpg",
  "https://files.catbox.moe/2g94h4.jpg",
  "https://files.catbox.moe/z7h6nj.jpg",
  "https://files.catbox.moe/e945km.jpg",
  "https://files.catbox.moe/tdh6zq.jpg"
];

const BOY_IMAGES = [
  "https://files.catbox.moe/6uizvk.jpg",
  "https://files.catbox.moe/m34aop.jpg",
  "https://files.catbox.moe/jwbrkr.jpg",
  "https://files.catbox.moe/y7c9p5.jpg",
  "https://files.catbox.moe/a33171.jpg",
  "https://files.catbox.moe/2zl7vk.jpg",
  "https://files.catbox.moe/dnq77s.jpg",
  "https://files.catbox.moe/312znf.jpg",
  "https://files.catbox.moe/5le1e7.jpg"
];

const getRandomImage = (mode) => {
  const images = mode === "girl" ? GIRL_IMAGES : BOY_IMAGES;
  return images[Math.floor(Math.random() * images.length)];
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
    names: ["play", "youtube", "tiktok", "instagram", "apk", "itunes", "podcast", "down-url", "url", "lyrics", "lyrics2", "lyrictts"]
  },
  {
    key: "converter",
    title: "Converter Menu",
    names: ["sticker", "photo", "tts", "tomp4", "vv", "vv2", "take", "img", "static-stick", "telegram-stick"]
  },
  {
    key: "ai",
    title: "AI Menu",
    names: ["ai", "openai", "deepseek", "imagine", "k-video", "sigmachat", "sigmavoice", "SIGMA MDX", "SIGMA MDXts"]
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
    names: ["anime", "manga", "film", "artist", "car", "muscu", "cours", "soulmate", "hentai"]
  },
  {
    key: "group",
    title: "Group Menu",
    names: [
      "add", "kick", "kickall", "promote", "promoteall", "demote", "demoteall",
      "tagall", "hidetag", "tag", "tagadmin", "welcome", "goodbye",
      "removemembers", "removeadmins", "removeall2", "revoke", "gclink",
      "ginfo", "infosgroups", "lockgc", "unlockgc", "mute", "unmute",
      "mute-time", "purge", "setgname", "setgdesc", "setppg", "settimeg",
      "gpass", "listonline", "alertadmin"
    ]
  },
  {
    key: "protection",
    title: "Protection Menu",
    names: [
      "antilink", "antibot", "antisticker", "antivideo", "antiaudio",
      "antimessage", "antipromote", "autoblock", "autoreact", "autovv",
      "protectionstate"
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
    const header = [
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
      `> ${headerIcon} ${currentMode === "girl" ? "Coucou" : "Yo"} *${userName}* !`,
      brandDesc ? `> 📝 ${brandDesc}` : null,
      brandPhone ? `> 📞 ${brandPhone}` : null,
      brandChannel ? `> 📢 ${brandChannel}` : null
    ].filter(Boolean).join("\n");

    const { all: allCommands, duplicates, sourcesByName, commandsByName } = await loadAllCommands();

    const remaining = new Set(allCommands.map((c) => String(c).toLowerCase()));
    const sections = [];

    for (const cat of MANUAL_CATEGORIES) {
      const items = [];
      for (const n of cat.names) {
        const key = String(n).toLowerCase();
        if (remaining.has(key)) {
          items.push(n);
          remaining.delete(key);
        }
      }
      if (items.length > 0) sections.push(section(cat.title, items));
    }

    const otherItems = [...remaining].sort((a, b) => a.localeCompare(b));
    if (otherItems.length > 0) {
      sections.push(section("Other Menu", otherItems));
    }

    if (duplicates.length > 0) {
      const dupLines = duplicates.slice(0, 20).map((n) => {
        const srcs = (sourcesByName.get(n) || []).join(" | ");
        return `${n}  (${srcs})`;
      });
      sections.push(section("Duplicates Detected", dupLines));
    }

    const text = [header, "", ...sections].join("\n\n");
    const menuImage = getRandomImage(currentMode);

    // 1. Envoi du menu avec l'image (image + texte du menu en légende)
    let menuSent = false;
    try {
      await Promise.race([
        sock.sendMessage(
          from,
          {
            image: { url: menuImage },
            caption: text,
            gifPlayback: true
          },
          { quoted: msg }
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("IMAGE_TIMEOUT")), 15000)
        )
      ]);
      menuSent = true;
    } catch (imgErr) {
      // Si l'image échoue (timeout / réseau), envoyer le menu en texte uniquement
      console.warn("⚠️ Menu: image non chargée, envoi du menu en texte:", imgErr.message);
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
              audio: { url: "https://files.catbox.moe/59g6u8.mp3" },
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
