import axios from "axios";

export const name = "quote";

export async function execute(sock, msg, args, from) {
  try {
    const response = await axios.get("https://api.quotable.io/random", { timeout: 10000 });
    const { content, author } = response.data;
    const message = `💬 *"${content}"*\n— ${author}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ`;
    await sock.sendMessage(from, { text: message }, { quoted: msg });
  } catch (err) {
    console.error("❌ Erreur quote:", err);
    await sock.sendMessage(from, {
      text: "⚠️ Impossible de récupérer une citation. Réessaie plus tard."
    }, { quoted: msg });
  }
}
