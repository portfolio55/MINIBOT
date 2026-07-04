import axios from "axios";

export const name = "lyrics";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;
    const songTitle = args.join(" ").trim();

    if (!songTitle) {
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY:⚠️ Veuillez entrer le nom de la chanson pour obtenir les paroles !\n\nExemple : .lyrics Shape of You"
      }, { quoted: msg });
      return;
    }

    const sentMsg = await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: 🔍 Recherche des paroles..." }, { quoted: msg });

    const { data } = await axios.get("https://api.gifted.co.ke/api/search/lyrics", {
      params: { apikey: GIFTED_KEY, query: songTitle },
      timeout: 20000
    });

    const result = data?.result;
    const lyrics = result?.lyrics;

    if (!data?.success || !lyrics) {
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY:⚠️ aucune parole trouvée pour : "${songTitle}"`
      }, { quoted: msg });
      return;
    }

    const maxChars = 4096;
    const output = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + "..." : lyrics;

    await sock.sendMessage(from, {
      text: `
> +----- LYRICS -----+
> SIGMA MDX DEPLOY: Titre trouvé
🎵 Chanson : ${result.artist ? `${result.artist} - ` : ""}${result.title || songTitle}
> -------------------
${output}
> +-----------------+`
    }, { quoted: sentMsg });

  } catch (error) {
    console.error("Erreur dans la commande lyrics :", error?.message || error);
    await sock.sendMessage(msg.key.remoteJid, {
      text: `> SIGMA MDX DEPLOY:⚠️ Une erreur est survenue lors de la récupération des paroles pour "${args.join(" ")}".`
    }, { quoted: msg });
  }
}
