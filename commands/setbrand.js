import fs from "fs";
import path from "path";

export const name = "setbrand";
export const ownerOnly = true;

const getBrandingFile = (botContext) => {
  const sessionPath = botContext?.sessionPath;
  return sessionPath ? path.join(sessionPath, "branding.json") : "./branding.json";
};

function readBranding(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

function saveBranding(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export async function execute(sock, msg, args, from, botContext) {
  const chat = from || msg.key.remoteJid;
  const file = getBrandingFile(botContext);

  if (!args?.length) {
    const cur = readBranding(file);
    const text = [
      "> Branding actuel:",
      `> Nom: ${cur.name || "(non defini)"}`,
      `> Telephone: ${cur.phone || "(non defini)"}`,
      `> Chaine: ${cur.channelLink || "(non definie)"}`,
      `> Description: ${cur.description || "(non definie)"}`,
      "",
      "> Utilisation:",
      "> .setbrand Nom | +324.... | https://whatsapp.com/channel/... | Ma description"
    ].join("\n");

    return await sock.sendMessage(chat, { text }, { quoted: msg });
  }

  const joined = args.join(" ");
  const parts = joined.split("|").map(s => s.trim()).filter(Boolean);

  if (parts.length < 4) {
    return await sock.sendMessage(chat, {
      text: "> Format invalide.\n> Utilisation: .setbrand Nom | +324.... | https://whatsapp.com/channel/... | Ma description"
    }, { quoted: msg });
  }

  const [name, phone, channelLink, ...rest] = parts;
  const description = rest.join(" | ");

  const updated = {
    ...readBranding(file),
    name,
    phone,
    channelLink,
    description,
    updatedAt: new Date().toISOString()
  };

  saveBranding(file, updated);

  await sock.sendMessage(chat, {
    text: `> ✅ Branding mis a jour.\n> Nom: ${name}\n> Telephone: ${phone}\n> Chaine: ${channelLink}`
  }, { quoted: msg });
}
