import fs from "fs";
import path from "path";

export const name = "autolike";
export const aliases = ["autolikestatus", "likestatus"];
export const ownerOnly = true;

const DEFAULT_EMOJI = "💚";
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

const getAutolikeFile = (botContext) => {
  const sessionPath = botContext?.sessionPath;
  return sessionPath ? path.join(sessionPath, "autolike.json") : "./autolike.json";
};

function loadAutolike(file) {
  if (!fs.existsSync(file)) return { enabled: false, emoji: DEFAULT_EMOJI };
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    return { enabled: !!data.enabled, emoji: data.emoji || DEFAULT_EMOJI };
  } catch {
    return { enabled: false, emoji: DEFAULT_EMOJI };
  }
}

function saveAutolike(file, config) {
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

const menuText = (config) => [
  "╭─────────────┈⊷",
  "┃ 💚 *AUTOLIKE STATUT*",
  "┃",
  `┃ État : ${config.enabled ? "✅ Activé" : "⚡ Désactivé"}`,
  `┃ Emoji : ${config.emoji}`,
  "┃",
  "┃ ⚙️ *Configuration*",
  "┃ • .autolike on — active",
  "┃ • .autolike off — désactive",
  "┃ • .autolike emoji <emoji> — change l'emoji",
  "┃ • .autolike status — affiche l'état actuel",
  "┃",
  "┃ 💡 Une fois activé, le bot réagit",
  "┃    automatiquement (en quelques secondes)",
  "┃    à chaque nouveau statut publié par",
  "┃    vos contacts.",
  "╰─────────────┈⊷"
].join("\n");

export async function execute(sock, msg, args, from, botContext) {
  const chat = from || msg.key.remoteJid;
  const file = getAutolikeFile(botContext);
  const config = loadAutolike(file);
  const arg = args[0]?.toLowerCase();

  if (!arg || !["on", "off", "emoji", "status", "help"].includes(arg)) {
    await sock.sendMessage(chat, { text: menuText(config) }, { quoted: msg });
    return;
  }

  if (arg === "on") {
    config.enabled = true;
    saveAutolike(file, config);
    await sock.sendMessage(
      chat,
      {
        text: `> SIGMA MDX DEPLOY : ✅ Autolike statut activé.\n> Le bot va désormais liker (${config.emoji}) automatiquement les statuts de vos contacts.`
      },
      { quoted: msg }
    );
    return;
  }

  if (arg === "off") {
    config.enabled = false;
    saveAutolike(file, config);
    await sock.sendMessage(
      chat,
      { text: "> SIGMA MDX DEPLOY : ⚡ Autolike statut désactivé." },
      { quoted: msg }
    );
    return;
  }

  if (arg === "emoji") {
    const emoji = args[1];
    if (!emoji || !EMOJI_REGEX.test(emoji)) {
      await sock.sendMessage(
        chat,
        { text: "> SIGMA MDX DEPLOY : ❌ Indique un emoji valide. Exemple : `.autolike emoji 🔥`" },
        { quoted: msg }
      );
      return;
    }
    config.emoji = emoji;
    saveAutolike(file, config);
    await sock.sendMessage(
      chat,
      { text: `> SIGMA MDX DEPLOY : ✅ Emoji autolike mis à jour : ${emoji}` },
      { quoted: msg }
    );
    return;
  }

  // status / help
  await sock.sendMessage(chat, { text: menuText(config) }, { quoted: msg });
}
