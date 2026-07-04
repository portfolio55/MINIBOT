import axios from "axios";
import yts from "yt-search";

export const name = "play";

const APIS = [
  {
    name: "apis-keith",
    getAudio: async (url) => {
      const res = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      return res.data?.result?.downloadUrl || res.data?.downloadUrl;
    }
  },
  {
    name: "api1",
    search: (q) => `https://api.vreden.my.id/api/ytplay?query=${encodeURIComponent(q)}`,
    parse: (data) => ({
      title: data.result?.title || data.title,
      duration: data.result?.duration || data.duration || "N/A",
      thumbnail: data.result?.thumbnail || data.thumb || data.thumbnail,
      video_url: data.result?.url || data.url,
      download_url: data.result?.download?.url || data.result?.audio || data.audio
    })
  },
  {
    name: "api2",
    search: (q) => `https://api.siputzx.my.id/api/d/ytmp3?url=ytsearch:${encodeURIComponent(q)}`,
    parse: (data) => ({
      title: data.data?.title || data.title,
      duration: data.data?.duration || "N/A",
      thumbnail: data.data?.thumbnail || data.thumb,
      video_url: data.data?.url || data.url,
      download_url: data.data?.dl || data.data?.download || data.download
    })
  },
  {
    name: "api3",
    search: (q) => `https://api.nyxs.pw/dl/yt-search?query=${encodeURIComponent(q)}`,
    parse: (data) => ({
      title: data.result?.[0]?.title || data.title,
      duration: data.result?.[0]?.duration || "N/A",
      thumbnail: data.result?.[0]?.thumbnail || data.thumb,
      video_url: data.result?.[0]?.url || data.url,
      download_url: data.result?.[0]?.audio || null
    })
  }
];

async function tryApis(query) {
  for (const api of APIS) {
    try {
      if (api.search) {
        const url = api.search(query);
        const { data } = await axios.get(url, { timeout: 15000 });
        if (data && (data.status || data.result || data.data)) {
          const parsed = api.parse(data);
          if (parsed.title && parsed.download_url) return parsed;
        }
      }
    } catch (e) {
      console.log(`Play API ${api.name} failed:`, e.message);
    }
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

    let video = null;

    // 1) Essai yt-search + apis-keith (comme plugin play2)
    try {
      const search = await yts(title);
      const data = search.videos?.[0];
      if (data?.url) {
        const audioUrl = await APIS[0].getAudio(data.url);
        if (audioUrl) {
          video = {
            title: data.title,
            duration: data.timestamp || "N/A",
            thumbnail: data.thumbnail,
            video_url: data.url,
            download_url: audioUrl
          };
        }
      }
    } catch (e) {
      console.log("Play yt-search/apis-keith:", e?.message);
    }

    if (!video) video = await tryApis(title);

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
