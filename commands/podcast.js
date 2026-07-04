import axios from "axios";

export const name = "podcast";

// Uses Google Translate's public (unofficial, no-key) text-to-speech
// endpoint. Text is chunked to respect its ~200 character limit per request.
const GOOGLE_TTS_ENDPOINT = "https://translate.google.com/translate_tts";
const MAX_CHUNK = 190;

function splitIntoChunks(text, maxLen) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf(".", maxLen);
    if (cut < maxLen * 0.4) cut = remaining.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1).trim();
  }
  return chunks;
}

async function fetchTtsChunk(text, lang = "fr") {
  const { data } = await axios.get(GOOGLE_TTS_ENDPOINT, {
    params: { ie: "UTF-8", q: text, tl: lang, client: "tw-ob" },
    headers: { "User-Agent": "Mozilla/5.0" },
    responseType: "arraybuffer",
    timeout: 20000
  });
  return Buffer.from(data);
}

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      await sock.sendMessage(from, {
        text: "> 🎙️ SIGMA MDX DEPLOY : Usage: !podcast <sujet>\nEx: !podcast intelligence artificielle"
      }, { quoted: msg });
      return;
    }

    const topic = args.join(" ");
    const text = `Bonjour, aujourd'hui nous parlons de ${topic}. C'est un sujet passionnant qui merite d'etre explore en detail.`;

    const chunks = splitIntoChunks(text, MAX_CHUNK).slice(0, 6);
    const buffers = await Promise.all(chunks.map((c) => fetchTtsChunk(c)));
    const audioBuffer = Buffer.concat(buffers);

    await sock.sendMessage(from, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      caption: `> 🎙️ SIGMA MDX DEPLOY : Podcast\nSujet: ${topic}`
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur podcast :", err?.message || err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service podcast indisponible." }, { quoted: msg });
  }
}
