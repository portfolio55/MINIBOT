export const name = "alive";

const ALIVE_IMG = "https://files.catbox.moe/zpg9wv.jpg";

function formatUptime(ms) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor((ms / (1000 * 60)) % 60);
  const h = Math.floor(ms / (1000 * 60 * 60));
  return `${h}h ${m}m ${s}s`;
}

export async function execute(sock, msg, args, from) {
  try {
    const pushname = msg.pushName || "User";
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const uptime = formatUptime(process.uptime() * 1000);

    const text = `🌟 *SIGMA MDX STATUS* 🌟
Hi 🫵🏽 ${pushname}
> 🕒 *Time*: ${timeStr}
> 📅 *Date*: ${dateStr}
> ⏳ *Uptime*: ${uptime}

> 🤖 *Status*: *ONLINE*

> 🎉 *Enjoy the Service!*
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ`;

    await sock.sendMessage(from, { text }, { quoted: msg });

    if (ALIVE_IMG && ALIVE_IMG.startsWith("http")) {
      try {
        await sock.sendMessage(from, { image: { url: ALIVE_IMG }, caption: text }, { quoted: msg });
      } catch (e) {
        console.warn("[alive] Image non envoyée:", e?.message);
      }
    }
    try {
      await sock.sendMessage(from, {
        audio: { url: "https://raw.githubusercontent.com/Mayelprince/url/main/url/Alan_Walker___Faded.mp3" },
        mimetype: "audio/mp4",
        ptt: true
      }, { quoted: msg });
    } catch (e) {
      console.warn("[alive] Audio non envoyé:", e?.message);
    }
  } catch (err) {
    console.error("❌ Erreur alive:", err);
    await sock.sendMessage(from, { text: "❌ Erreur lors de l'exécution de la commande alive." }, { quoted: msg });
  }
}
