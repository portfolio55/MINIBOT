export const name = "ping";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;
  try {
    const start = Date.now();
    const sentMsg = await sock.sendMessage(from, { text: "𝗣𝗶𝗻𝗴𝗶𝗻𝗴..." }, { quoted: msg });
    const ping = Date.now() - start;
    await sock.sendMessage(from, { text: `📍 *Ping* : ${ping} ms\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ` }, { quoted: sentMsg });
  } catch (err) {
    console.error("❌ Erreur ping :", err);
    await sock.sendMessage(from, { text: "> ❌ Impossible de calculer la vitesse." }, { quoted: msg });
  }
};
