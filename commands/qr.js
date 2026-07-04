import axios from "axios";

export const name = "qr";

const GIFTED_QR_ENDPOINT = "https://api.giftedtech.co.ke/api/tools/createqr";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args, from) {
  const query = args.join(" ").trim();
  if (!query) {
    return await sock.sendMessage(from, {
      text: "❎ Donne un texte pour générer le QR.\nExemple: qr Gifted Tech"
    }, { quoted: msg });
  }

  try {
    const res = await axios.get(GIFTED_QR_ENDPOINT, {
      params: { apikey: GIFTED_API_KEY, query },
      responseType: "arraybuffer",
      timeout: 30000
    });

    const buffer = Buffer.from(res.data);
    await sock.sendMessage(from, {
      image: buffer,
      caption: `✅ QR généré pour: ${query}`
    }, { quoted: msg });
  } catch (err) {
    console.error("❌ Erreur qr:", err?.message || err);
    await sock.sendMessage(from, {
      text: "⚠️ Impossible de générer le QR. Réessaie plus tard."
    }, { quoted: msg });
  }
}
