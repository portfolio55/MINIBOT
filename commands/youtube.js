export const name = "youtube";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      return await sock.sendMessage(from, {
        text: "> ❌ SIGMA MDX DEPLOY ?\n\n> Usage: !youtube <URL YouTube>\n> Ex: !youtube https://youtu.be/dQw4w9WgXcQ"
      }, { quoted: msg });
    }

    const youtubeUrl = args[0];
    const format = args[1] || "mp4";
    
    // API YouTube
    const apiUrl = `https://delirius-apiofc.vercel.app/download/youtube?url=${encodeURIComponent(youtubeUrl)}&format=${format}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data || !data.status || !data.data) {
      return await sock.sendMessage(from, {
        text: "> ?? SIGMA MDX DEPLOY : échec de la récupération de la vidéo YouTube.",
      }, { quoted: msg });
    }

    const { title, duration, channel, views, url } = data.data;

    const caption = `> ❌ SIGMA MDX DEPLOY ?

> ℹ️ INFORMATIONS
> ?? Titre : ${title.substring(0, 60)}...
> ?? Durée : ${duration}
> ?? Chaéne : ${channel}
> 🎨 Vues : ${views}
> ?? Format : ${format.toUpperCase()}
> ?? Téléchargement terminé ?

> Dev by SIGMA MDX`;

    if (format === "mp3") {
      await sock.sendMessage(from, {
        audio: { url: url },
        mimetype: 'audio/mpeg',
        caption
      }, { quoted: msg });
    } else {
      await sock.sendMessage(from, {
        video: { url: url },
        caption
      }, { quoted: msg });
    }

  } catch (err) {
    console.error("? Erreur YouTube :", err);
    await sock.sendMessage(from, {
      text: `> ❌ SIGMA MDX DEPLOY ?\n\n> ?? Service temporairement indisponible.\n> Essayez: https://y2mate.com`
    }, { quoted: msg });
  }
}