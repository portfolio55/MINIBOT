import axios from "axios";
import yts from "yt-search";

export const name = "son";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

async function downloadFromGifted(video, attempt = 1) {
  try {
    const { data } = await axios.get("https://api.gifted.co.ke/api/download/ytmp3v2", {
      params: { apikey: GIFTED_KEY, url: video.url },
      timeout: 30000
    });

    const result = data?.result;
    if (!data?.success || !result?.download_url) {
      console.log(`Son: réponse Gifted invalide pour ${video.url} (tentative ${attempt}):`, JSON.stringify(data)?.slice(0, 300));
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
    console.log(`Son: Gifted ytmp3v2 échec pour ${video.url} (tentative ${attempt}):`, e.response?.status, e.message);
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1500));
      return downloadFromGifted(video, attempt + 1);
    }
    return null;
  }
}

async function searchAndDownload(query) {
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
  const jid = from || msg.key.remoteJid;
  const title = args.join(" ").trim();

  if (!title) {
    return await sock.sendMessage(jid, {
      text: "> SIGMA MDX DEPLOY : Donne le nom ou le titre de la chanson.\nExemple : .son Nom de la chanson"
    }, { quoted: msg });
  }

  try {
    await sock.sendMessage(jid, {
      text: `> SIGMA MDX DEPLOY : 🔍 Recherche de *${title}* en cours...`
    }, { quoted: msg });

    const song = await searchAndDownload(title);

    if (!song || !song.download_url) {
      return await sock.sendMessage(jid, {
        text: "> SIGMA MDX DEPLOY : Aucun résultat ou lien indisponible."
      }, { quoted: msg });
    }

    const caption = `*⦁ SON DOWNLOAD ⦁*

🎵 *Titre:* ${song.title}
⏳ *Durée:* ${song.duration}
${song.video_url ? `🖇 *Lien:* ${song.video_url}` : ""}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ sɪɢᴍᴀ ᴍᴅx`;

    await sock.sendMessage(jid, {
      audio: { url: song.download_url },
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${song.title || "son"}.mp3`
    }, { quoted: msg });

    await sock.sendMessage(jid, { text: caption }, { quoted: msg });
  } catch (err) {
    console.error("Erreur son :", err);
    await sock.sendMessage(jid, {
      text: `> SIGMA MDX DEPLOY : Échec du téléchargement.\n${err?.message || err}`
    }, { quoted: msg });
  }
}
