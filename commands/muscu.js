import axios from "axios";

export const name = "muscu";

const GIFTED_SEARCH_ENDPOINT = "https://api.gifted.co.ke/api/search/google";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const muscle = args.join(" ") || "biceps";

    const { data } = await axios.get(GIFTED_SEARCH_ENDPOINT, {
      params: { apikey: GIFTED_API_KEY, query: `best ${muscle} exercise workout instructions` },
      timeout: 20000
    });

    const results = data?.results;
    if (!data?.success || !Array.isArray(results) || !results.length) {
      await sock.sendMessage(from, { text: "> ❌ SIGMA MDX DEPLOY : Exercice non trouvé." }, { quoted: msg });
      return;
    }

    const top = results.slice(0, 3);
    const lines = top.map((r, i) => `*${i + 1}. ${r.title}*\n${r.description || ""}\n🔗 ${r.link}`).join("\n\n");

    const reply = `> 💪 SIGMA MDX DEPLOY : Exercices - ${muscle}
🎨🎨🎨🎨🎨🎨
${lines}`;

    await sock.sendMessage(from, { text: reply }, { quoted: msg });

  } catch (err) {
    console.error("Erreur exercise :", err?.message || err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service exercices indisponible." }, { quoted: msg });
  }
}
