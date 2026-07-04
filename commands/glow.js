import axios from "axios";

export const name = "glow";

const GIFTED_GLOW_ENDPOINT = "https://api.giftedtech.co.ke/api/ephoto360/advancedglow";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args, from) {
  const text = args.join(" ").trim();
  if (!text) {
    return await sock.sendMessage(from, {
      text: "❎ Donne un texte.\nExemple: glow Gifted Tech"
    }, { quoted: msg });
  }

  try {
    const res = await axios.get(GIFTED_GLOW_ENDPOINT, {
      params: { apikey: GIFTED_API_KEY, text },
      timeout: 30000
    });

    const imgUrl = res.data?.result?.image_url;
    if (!res.data?.success || !imgUrl) {
      return await sock.sendMessage(from, {
        text: "❌ Aucun résultat. Réessaie plus tard."
      }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      image: { url: imgUrl },
      caption: `✨ Glow: ${text}`
    }, { quoted: msg });
  } catch (err) {
    console.error("❌ Erreur glow:", err?.message || err);
    await sock.sendMessage(from, {
      text: "⚠️ Impossible de générer l'image glow. Réessaie plus tard."
    }, { quoted: msg });
  }
}
