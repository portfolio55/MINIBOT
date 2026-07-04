import axios from "axios";

export const name = "tiktok";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const tiktokUrl = args.join(" ").trim();

    if (!tiktokUrl) {
      return await sock.sendMessage(from, {
        text: "> ⚠️ SIGMA MDX DEPLOY : Fournis un lien TikTok à télécharger.\nExemple : .tiktok https://www.tiktok.com/@user/video/1234567890",
      }, { quoted: msg });
    }

    if (!tiktokUrl.includes("tiktok.com")) {
      return await sock.sendMessage(from, {
        text: "> ⚠️ SIGMA MDX DEPLOY : Le lien fourni n'est pas valide.",
      }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      text: "⏳ SIGMA MDX DEPLOY : Téléchargement de la vidéo TikTok en cours..."
    }, { quoted: msg });

    const { data } = await axios.get("https://api.gifted.co.ke/api/download/tiktok", {
      params: { apikey: GIFTED_KEY, url: tiktokUrl },
      timeout: 30000
    });

    const result = data?.result;
    if (!data?.success || !result?.video) {
      return await sock.sendMessage(from, {
        text: "> ⚠️ SIGMA MDX DEPLOY : échec de la récupération de la vidéo TikTok.",
      }, { quoted: msg });
    }

    const { title, duration, video } = result;

    const caption = `> ✅ SIGMA MDX DEPLOY

>  INFORMATIONS
>  🎬 Titre : ${(title || "N/A").substring(0, 80)}
>  ⏱ Durée : ${duration || "N/A"}s
> ✅ Téléchargement terminé

> Dev by SIGMA MDX`;

    await sock.sendMessage(from, {
      video: { url: video },
      caption
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur TikTok :", err?.message || err);
    await sock.sendMessage(from, {
      text: `> ⚠️ SIGMA MDX DEPLOY : Une erreur est survenue.\nDétails : ${err?.message || err}`
    }, { quoted: msg });
  }
}
