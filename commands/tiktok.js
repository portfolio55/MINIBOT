export const name = "tiktok";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const tiktokUrl = args.join(" ").trim();

    // Vérifications de base
    if (!tiktokUrl) {
      return await sock.sendMessage(from, {
        text: "> ?? SIGMA MDX DEPLOY : Fournis un lien TikTok à télécharger.\nExemple : .tiktokdl https://www.tiktok.com/@user/video/1234567890",
      }, { quoted: msg });
    }

    if (!tiktokUrl.includes("tiktok.com")) {
      return await sock.sendMessage(from, {
        text: "> ?? SIGMA MDX DEPLOY : Le lien fourni n'est pas valide.",
      }, { quoted: msg });
    }

    // Message de progression
    await sock.sendMessage(from, {
      text: "? SIGMA MDX DEPLOY : Téléchargement de la vidéo TikTok en cours..."
    }, { quoted: msg });

    // Requête API
    const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(tiktokUrl)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data || !data.status || !data.data) {
      return await sock.sendMessage(from, {
        text: "> ?? SIGMA MDX DEPLOY : échec de la récupération de la vidéo TikTok.",
      }, { quoted: msg });
    }

    const { title, like, comment, share, author, meta } = data.data;

    // Récupère la vidéo sans watermark
    const videoObj = meta.media.find(v => v.type === "video");
    const videoUrl = videoObj?.org;

    if (!videoUrl) {
      return await sock.sendMessage(from, {
        text: "> ?? SIGMA MDX DEPLOY : Aucun lien vidéo disponible.",
      }, { quoted: msg });
    }

    // Légende stylisée SIGMA MDX MD
    const caption = `> ?SIGMA MDX DEPLOY?

>  INFORMATIONS
>  ?? Auteur : ${author.nickname}
>  ?? Likes : ${like}
>  ?? Commentaires : ${comment}
>  ?? Partages : ${share}
> ?? Téléchargement terminé ?

> Dev by SIGMA MDX`;

    // Envoi de la vidéo
    await sock.sendMessage(from, {
      video: { url: videoUrl },
      caption
    }, { quoted: msg });

  } catch (err) {
    console.error("? Erreur TikTok :", err);
    await sock.sendMessage(from, {
      text: `> ?? SIGMA MDX DEPLOY : Une erreur est survenue.\nDétails : ${err.message}`
    }, { quoted: msg });
  }
}