import axios from "axios";

export const name = "lyrictts";
export const description = "Convert song lyrics to voice (TTS)";

const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, m, args) {
  try {
    const jid = m.key.remoteJid;

    if (!args.length || !args.join(" ").includes("|")) {
      return sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY ⚠️ Usage: .lyrictts artist | song" },
        { quoted: m }
      );
    }

    const [artist, title] = args.join(" ").split("|").map(v => v.trim());

    // ===== LYRICS via Gifted =====
    const { data: lyricsData } = await axios.get("https://api.gifted.co.ke/api/search/lyrics", {
      params: { apikey: GIFTED_KEY, query: `${title} ${artist}` },
      timeout: 20000
    });

    const lyricsResult = lyricsData?.result;
    if (!lyricsData?.success || !lyricsResult?.lyrics) {
      return sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY ❌ Lyrics not found." },
        { quoted: m }
      );
    }

    const text = lyricsResult.lyrics
      .replace(/\n+/g, ". ")
      .slice(0, 1800);

    // ===== GOOGLE TTS (free, keyless) =====
    const ttsURL =
      "https://translate.google.com/translate_tts" +
      `?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(text)}`;

    const audioRes = await axios.get(ttsURL, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 20000
    });
    const audioBuffer = Buffer.from(audioRes.data);

    await sock.sendMessage(
      jid,
      {
        audio: audioBuffer,
        mimetype: "audio/mpeg",
        ptt: true
      },
      { quoted: m }
    );

  } catch (err) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: `❌ SIGMA MDX DEPLOY TTS Error: ${err.message}` },
      { quoted: m }
    );
  }
}
