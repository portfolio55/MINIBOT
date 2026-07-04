import axios from "axios";

export const name = "youtube";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      return await sock.sendMessage(from, {
        text: "> ❌ SIGMA MDX DEPLOY ?\n\n> Usage: !youtube <URL YouTube>\n> Ex: !youtube https://youtu.be/dQw4w9WgXcQ"
      }, { quoted: msg });
    }

    const youtubeUrl = args[0];
    const format = (args[1] || "mp4").toLowerCase();

    const endpoint = format === "mp3" ? "ytmp3v2" : "ytmp4";
    const apiUrl = `https://api.gifted.co.ke/api/download/${endpoint}`;
    const { data } = await axios.get(apiUrl, {
      params: { apikey: GIFTED_KEY, url: youtubeUrl },
      timeout: 30000
    });

    const result = data?.result;
    if (!data?.success || !result?.download_url) {
      return await sock.sendMessage(from, {
        text: "> ❌ SIGMA MDX DEPLOY : échec de la récupération de la vidéo YouTube.",
      }, { quoted: msg });
    }

    const { title, quality, download_url } = result;

    const caption = `> ❌ SIGMA MDX DEPLOY

> ℹ️ INFORMATIONS
> 🎬 Titre : ${(title || "N/A").substring(0, 60)}
> ⭐ Qualité : ${quality || "N/A"}
> 📁 Format : ${format.toUpperCase()}
> ✅ Téléchargement terminé

> Dev by SIGMA MDX`;

    if (format === "mp3") {
      await sock.sendMessage(from, {
        audio: { url: download_url },
        mimetype: 'audio/mpeg',
        caption
      }, { quoted: msg });
    } else {
      await sock.sendMessage(from, {
        video: { url: download_url },
        caption
      }, { quoted: msg });
    }

  } catch (err) {
    console.error("Erreur YouTube :", err?.message || err);
    await sock.sendMessage(from, {
      text: `> ❌ SIGMA MDX DEPLOY : Service temporairement indisponible.\nDétails : ${err?.message || err}`
    }, { quoted: msg });
  }
}
