import axios from "axios";

export const name = "lyrics2";
export const description = "Get song lyrics";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, m, args) {
  try {
    const jid = m.key.remoteJid;

    if (!args.length || !args.join(" ").includes("|")) {
      return sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY ⚠️ Usage: .lyrics2 artist | song" },
        { quoted: m }
      );
    }

    const [artist, title] = args.join(" ").split("|").map(v => v.trim());

    const { data } = await axios.get("https://api.gifted.co.ke/api/search/lyrics", {
      params: { apikey: GIFTED_KEY, query: `${title} ${artist}` },
      timeout: 20000
    });

    const result = data?.result;
    if (!data?.success || !result?.lyrics) {
      return sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY ❌ Lyrics not found." },
        { quoted: m }
      );
    }

    const lyrics = result.lyrics.length > 3500
      ? result.lyrics.slice(0, 3500) + "\n\n[...truncated]"
      : result.lyrics;

    await sock.sendMessage(
      jid,
      {
        text:
`⚡ *Lyrics Found*

🎤 Artist: ${result.artist || artist}
🎵 Song: ${result.title || title}

${lyrics}`
      },
      { quoted: m }
    );

  } catch (e) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: `❌ SIGMA MDX DEPLOY Lyrics Error: ${e.message}` },
      { quoted: m }
    );
  }
}
