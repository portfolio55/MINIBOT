import fs from "fs";
import { getBotMode, setBotMode } from "../src/utils/botMode.js";

export const name = "mode";

const MODE_FILE = "./mode.json";

// Initialiser le fichier mode si nécessaire (pour index.js mono-utilisateur)
if (!fs.existsSync(MODE_FILE)) {
  fs.writeFileSync(MODE_FILE, JSON.stringify({ mode: "boy" }, null, 2));
}

export function getMode() {
  try {
    if (!fs.existsSync(MODE_FILE)) return "boy";
    const data = JSON.parse(fs.readFileSync(MODE_FILE, "utf-8"));
    return data.mode || "boy";
  } catch {
    return "boy";
  }
}

export function setMode(mode) {
  fs.writeFileSync(MODE_FILE, JSON.stringify({ mode: mode.toLowerCase() }, null, 2));
}

export async function execute(sock, msg, args, from, botContext) {
  const sessionPath = botContext?.sessionPath;
  const currentMode = sessionPath ? await getBotMode(sessionPath) : getMode();

  if (!args[0]) {
    const modeEmoji = currentMode === "girl" ? "🦋" : "🐸";
    await sock.sendMessage(from, {
      text: `> ⚙️ *MODE ACTUEL* : ${modeEmoji} *${currentMode.toUpperCase()}*\n\n> 📝 *Usage:*\n> • \`mode boy\` - Mode masculin 🐸\n> • \`mode girl\` - Mode féminin 🦋\n\n> _Cela change l'apparence du menu et les images du bot_`
    }, { quoted: msg });
    return;
  }

  const newMode = args[0].toLowerCase();

  if (newMode !== "boy" && newMode !== "girl") {
    await sock.sendMessage(from, {
      text: "> ❌ *Mode invalide!*\n\n> Utilise: `mode boy` ou `mode girl`"
    }, { quoted: msg });
    return;
  }

  if (newMode === currentMode) {
    const modeEmoji = currentMode === "girl" ? "🦋" : "🐸";
    await sock.sendMessage(from, {
      text: `> ℹ️ Le mode *${currentMode.toUpperCase()}* ${modeEmoji} est déjà activé!`
    }, { quoted: msg });
    return;
  }

  if (sessionPath) {
    await setBotMode(sessionPath, newMode);
  } else {
    setMode(newMode);
  }

  const emoji = newMode === "girl" ? "🦋" : "🐸";
  const image = newMode === "girl"
    ? "https://files.catbox.moe/gif51b.jpg"
    : "https://files.catbox.moe/6uizvk.jpg";

  await sock.sendMessage(from, {
    image: { url: image },
    caption: `> ✅ *MODE CHANGÉ*\n\n> ${emoji} Mode *${newMode.toUpperCase()}* activé!\n\n> _Le menu et les images du bot ont été mis à jour._\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*`
  }, { quoted: msg });
}
