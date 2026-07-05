import axios from "axios";
import yts from "yt-search";

export const name = "play";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";
const CHOICE_TTL_MS = 90 * 1000;

// [PLAY INTERACTIF] État des choix en attente (audio/vidéo), par bot+chat+expéditeur.
// Consommé par handlePendingPlayReply(), appelé depuis botManager.js AVANT le routage
// normal des commandes (pour intercepter une simple réponse "1" ou "2").
const pendingChoices = new Map();

function choiceKey(uuid, from, sender) {
  return `${uuid}:${from}:${sender}`;
}

async function downloadFromGifted(video, format, attempt = 1) {
  const endpoint = format === "audio" ? "ytmp3v2" : "ytmp4";
  try {
    const { data: apiRes } = await axios.get(`https://api.gifted.co.ke/api/download/${endpoint}`, {
      params: { apikey: GIFTED_KEY, url: video.url },
      timeout: 45000
    });

    const result = apiRes?.result;
    if (!apiRes?.success || !result?.download_url) {
      console.log(`Play: réponse Gifted invalide (${endpoint}) pour ${video.url} (tentative ${attempt}):`, JSON.stringify(apiRes)?.slice(0, 300));
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
    console.log(`Play: Gifted ${endpoint} échec pour ${video.url} (tentative ${attempt}):`, e.response?.status, e.message);
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1500));
      return downloadFromGifted(video, format, attempt + 1);
    }
    return null;
  }
}

const YT_URL_REGEX = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/\S+/i;

function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function resolveVideo(input) {
  const isUrl = YT_URL_REGEX.test(input);

  if (isUrl) {
    try {
      const info = await yts({ videoId: extractVideoId(input) });
      return {
        url: input,
        title: info?.title,
        timestamp: info?.timestamp || info?.duration?.timestamp,
        thumbnail: info?.thumbnail
      };
    } catch {
      return { url: input, title: null, timestamp: "N/A", thumbnail: null };
    }
  }

  const search = await yts(input);
  const video = (search.videos || [])[0];
  if (!video?.url) return null;
  return video;
}

async function sendResult(sock, msg, from, video, format) {
  const result = await downloadFromGifted(video, format);

  if (!result || !result.download_url) {
    return await sock.sendMessage(from, {
      text: "> SIGMA MDX DEPLOY : Aucun résultat ou lien indisponible."
    }, { quoted: msg });
  }

  const caption = `*⦁ ${format === "audio" ? "MUSIC" : "VIDEO"} DOWNLOAD ⦁*

🎵 *Titre:* ${result.title}
⏳ *Durée:* ${result.duration}
${result.video_url ? `🖇 *Lien:* ${result.video_url}` : ""}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ`;

  if (format === "audio") {
    if (result.thumbnail) {
      try {
        await sock.sendMessage(from, { image: { url: result.thumbnail }, caption }, { quoted: msg });
      } catch (_) {
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }
    } else {
      await sock.sendMessage(from, { text: caption }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      audio: { url: result.download_url },
      mimetype: "audio/mpeg",
      ptt: false
    }, { quoted: msg });
  } else {
    await sock.sendMessage(from, {
      video: { url: result.download_url },
      caption
    }, { quoted: msg });
  }
}

export async function execute(sock, msg, args, from, botContext) {
  const input = args.join(" ").trim();
  if (!input) {
    return await sock.sendMessage(from, {
      text: "> SIGMA MDX DEPLOY : Donne un lien YouTube ou un titre/artiste.\nExemple : .play https://youtu.be/xxxx\nExemple : .play Nom de la chanson"
    }, { quoted: msg });
  }

  const uuid = botContext?.uuid || "default";
  const sender = msg.key.participant || from;

  try {
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : 🔍 Recherche de *${input}* en cours...`
    }, { quoted: msg });

    const video = await resolveVideo(input);
    if (!video || !video.url) {
      return await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY : Aucun résultat trouvé."
      }, { quoted: msg });
    }

    const key = choiceKey(uuid, from, sender);
    const existing = pendingChoices.get(key);
    if (existing?.timeout) clearTimeout(existing.timeout);

    const timeout = setTimeout(() => pendingChoices.delete(key), CHOICE_TTL_MS);
    pendingChoices.set(key, { video, sock, msg, from, timeout });

    await sock.sendMessage(from, {
      text: `*⦁ SIGMA MDX DEPLOY ⦁*\n\n🎬 *${video.title || input}*\n⏳ ${video.timestamp || "N/A"}\n\nRéponds avec un numéro pour choisir le format :\n1️⃣ Audio (MP3)\n2️⃣ Vidéo (MP4)\n\n_expire dans 90s_`
    }, { quoted: msg });
  } catch (err) {
    console.error("Erreur play :", err);
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : Échec.\n${err?.message || err}`
    }, { quoted: msg });
  }
}

/**
 * Intercepte une réponse "1"/"2" à un choix .play en attente.
 * Retourne true si le message a été consommé comme réponse de choix (ne pas router en commande),
 * false sinon.
 */
export async function handlePendingPlayReply(uuid, from, sender, text) {
  const key = choiceKey(uuid, from, sender);
  const pending = pendingChoices.get(key);
  if (!pending) return false;

  const choice = text.trim();
  if (choice !== "1" && choice !== "2") return false;

  clearTimeout(pending.timeout);
  pendingChoices.delete(key);

  const format = choice === "1" ? "audio" : "video";
  const { sock, msg, video } = pending;

  try {
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : ⏳ Téléchargement en ${format === "audio" ? "audio" : "vidéo"} en cours...`
    }, { quoted: msg });
    await sendResult(sock, msg, from, video, format);
  } catch (err) {
    console.error("Erreur play (choix) :", err);
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : Échec.\n${err?.message || err}`
    }, { quoted: msg });
  }

  return true;
}
