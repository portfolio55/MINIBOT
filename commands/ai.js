import axios from "axios";

export const name = "ai";

const AI_APIS = [
  {
    name: "GiftedTech",
    call: async (query) => {
      const { data } = await axios.get("https://api.giftedtech.co.ke/api/ai/ai", {
        params: { apikey: process.env.GIFTED_API_KEY || "gifted", q: query },
        timeout: 15000
      });
      return data?.result || data?.message || data?.answer || null;
    }
  },
  {
    name: "BK9",
    call: async (query) => {
      const { data } = await axios.get("https://bk9.fun/ai/GPT4o", {
        params: { q: query },
        timeout: 15000
      });
      return data?.BK9 || data?.result || null;
    }
  },
  {
    name: "DreamAPI",
    call: async (query) => {
      const { data } = await axios.get("https://api.dreamamazon.com/api/ai", {
        params: { query: query },
        timeout: 15000
      });
      return data?.result || data?.response || data?.answer || null;
    }
  }
];

async function queryAI(query) {
  for (const api of AI_APIS) {
    try {
      const result = await api.call(query);
      if (result) return result;
    } catch {
      continue;
    }
  }
  return null;
}

export async function execute(sock, msg, args, from) {
  const query = args.join(" ").trim();
  if (!query) {
    return await sock.sendMessage(from, {
      text: "> SIGMA MDX DEPLOY : Fournis un message pour l'IA.\nExemple : !ai Bonjour"
    }, { quoted: msg });
  }

  try {
    await sock.sendMessage(from, { text: "🤖 Reflexion en cours..." }, { quoted: msg });

    const answer = await queryAI(query);
    if (!answer) {
      return await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY : L'IA n'a pas repondu. Reessaie plus tard."
      }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      text: `🤖 *Reponse IA:*\n\n${answer}\n\n> *powered by SIGMA MDX*`
    }, { quoted: msg });
  } catch (err) {
    console.error("Erreur AI :", err);
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : Erreur.\n${err?.message || err}`
    }, { quoted: msg });
  }
}
