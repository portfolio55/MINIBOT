import axios from "axios";

export const name = "ssweb";

const GIFTED_SSWEB_ENDPOINT = "https://api.giftedtech.co.ke/api/tools/ssweb";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args, from) {
  const url = args[0];
  if (!url) {
    return await sock.sendMessage(from, {
      text: "❎ Donne un lien à screenshot.\nExemple: ssweb https://google.com"
    }, { quoted: msg });
  }

  try {
    const res = await axios.get(GIFTED_SSWEB_ENDPOINT, {
      params: { apikey: GIFTED_API_KEY, url },
      responseType: "arraybuffer",
      timeout: 60000
    });

    const buffer = Buffer.from(res.data);
    await sock.sendMessage(from, {
      image: buffer,
      caption: `✅ Screenshot: ${url}`
    }, { quoted: msg });
  } catch (err) {
    console.error("❌ Erreur ssweb:", err?.message || err);
    await sock.sendMessage(from, {
      text: "⚠️ Impossible de faire le screenshot. Réessaie plus tard."
    }, { quoted: msg });
  }
}
