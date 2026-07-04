import axios from "axios";

export const name = "fancy";

const GIFTED_FANCY_ENDPOINT = "https://api.giftedtech.co.ke/api/tools/fancyv2";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args, from) {
  const text = args.join(" ").trim();
  if (!text) {
    return await sock.sendMessage(from, {
      text: "❎ Donne un texte à convertir.\nExemple : fancy Hello"
    }, { quoted: msg });
  }
  try {
    const response = await axios.get(GIFTED_FANCY_ENDPOINT, {
      params: {
        apikey: GIFTED_API_KEY,
        text
      },
      timeout: 30000
    });

    const results = response.data?.results;
    if (!response.data?.success || !Array.isArray(results)) {
      return await sock.sendMessage(from, {
        text: "❌ Aucun style récupéré. Réessaie plus tard."
      }, { quoted: msg });
    }

    const limited = results.slice(0, 25);
    const lines = limited.map((item) => `*${item.name}:*\n${item.result}`).join("\n\n");
    const more = results.length > limited.length ? `\n\n(+${results.length - limited.length} autres styles)` : "";
    const resultText = `✨ *Fancy Fonts* ✨\n\n${lines}${more}`;

    await sock.sendMessage(from, { text: resultText }, { quoted: msg });
  } catch (err) {
    console.error("❌ Erreur fancy:", err);
    await sock.sendMessage(from, {
      text: "⚠️ Erreur lors de la récupération des polices."
    }, { quoted: msg });
  }
}
