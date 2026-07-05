import axios from "axios";
import yts from "yt-search";

export const name = "play";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

async function downloadFromGifted(video, attempt = 1) {
  try {
    const { data: apiRes } = await axios.get("https://api.gifted.co.ke/api/download/ytmp3v2", {
      params: { apikey: GIFTED_KEY, url: video.url },
      timeout: 30000
    });

    const result = apiRes?.result;
    if (!apiRes?.success || !result?.download_url) {
      console.log(`Play: réponse Gifted invalide pour ${video.url} (tentative ${attempt}):`, JSON.stringify(apiRes)?.slice(0, 300));
      return null;
    }

    return {
      title: result.title || video.title,
      duration: video.timestamp || "N/A",
      thumbnail: result.thumbnail || video.thumbnail,
      video_url: video.url,
      download_url: result.download_url
    };
  } catch (e) {
    console.log(`Play: Gifted ytmp3v2 échec pour ${video.url} (tentative ${attempt}):`, e.response?.status, e.message);
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1500));
      return downloadFromGifted(video, attempt + 1);
    }
    return null;
  }
}

async function tryApis(query) {
  const search = await yts(query);
  const candidates = (search.videos || []).slice(0, 3);

  for (const video of candidates) {
    if (!video?.url) continue;
    const result = await downloadFromGifted(video);
    if (result) return result;
  }

  return null;
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
