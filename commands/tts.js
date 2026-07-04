import fs from "fs";
import path from "path";
import gTTS from "node-gtts";

export const name = "tts";
export const description = "Text to Speech FR (voix féminine)";
export const category = "Fun";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;
    const tempDir = "./temp";
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    // Récupération du texte (reply ou args)
    let text =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      args.join(" ");

    if (!text) {
      return await sock.sendMessage(
        from,
        {
          text:
            "? *SIGMA MDX DEPLOY TTS*\n\n" +
            "Utilisation :\n" +
            "é `.tts Bonjour tout le monde`\n" +
            "é Répondre à un message : `.tts`"
        },
        { quoted: msg }
      );
    }

    // Initialisation TTS fran'ais
    const tts = gTTS("fr");
    const filePath = path.join(tempDir, `tts_${Date.now()}.mp3`);

    // Génération audio
    tts.save(filePath, text, async () => {
      await sock.sendMessage(
        from,
        {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/mpeg",
          ptt: false
        },
        { quoted: msg }
      );

      fs.unlinkSync(filePath);
    });

  } catch (err) {
    console.error("? SIGMA MDX DEPLOY TTS Error:", err);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "? *SIGMA MDX DEPLOY*: Erreur TTS." },
      { quoted: msg }
    );
  }
}