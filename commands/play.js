import axios from "axios";
import yts from "yt-search";

export const name = "play";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

async function tryApis(query) {
  try {
    const search = await yts(query);
    const data = search.videos?.[0];
    if (!data?.url) return null;

    const { data: apiRes } = await axios.get("https://api.gifted.co.ke/api/download/ytmp3v2", {
      params: { apikey: GIFTED_KEY, url: data.url },
      timeout: 25000
    });

    const result = apiRes?.result;
    if (!result?.download_url) return null;

    return {
      title: result.title || data.title,
      duration: data.timestamp || "N/A",
      thumbnail: result.thumbnail || data.thumbnail,
      video_url: data.url,
      download_url: result.download_url
    };
  } catch (e) {
    console.log("Play Gifted ytmp3v2 failed:", e.message);
    return null;
  }
}

export async function execute(sock, msg, args, from) {
  const title = args.join(" ").trim();
  if (!title) {
    return await sock.sendMessage(from, {
      text: "> SIGMA MDX DEPLOY : Donne un titre ou un artiste.\nExemple : !play Nom de la chanson"
    }, { quoted: msg });
  }

  try {
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : 🔍 Recherche de *${title}* en cours...`
    }, { quoted: msg });

    const video = await tryApis(title);

    if (!video || !video.download_url) {
      return await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY : Aucun résultat ou lien indisponible."
      }, { quoted: msg });
    }

    const caption = `*⦁ MUSIC DOWNLOAD ⦁*

🎵 *Titre:* ${video.title}
⏳ *Durée:* ${video.duration}
${video.video_url ? `🖇 *Lien:* ${video.video_url}` : ""}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ`;

    if (video.thumbnail) {
      try {
        await sock.sendMessage(from, { image: { url: video.thumbnail }, caption }, { quoted: msg });
      } catch (_) {
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }
    } else {
      await sock.sendMessage(from, { text: caption }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      audio: { url: video.download_url },
      mimetype: "audio/mpeg",
      ptt: false
    }, { quoted: msg });
  } catch (err) {
    console.error("Erreur play :", err);
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : Échec.\n${err?.message || err}`
    }, { quoted: msg });
  }
}
