import axios from "axios";
import fs from "fs";
import gTTS from "node-gtts";
import path from "path";

export const name = "SIGMA MDXts";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;
    const query = args.join(" ");

    // Vérification si une question est posée
    if (!query) {
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY : *Usage incorrect...*\n> Exemple : .SIGMA MDX combien de continents compte la Terre ?"
      }, { quoted: msg });
      return;
    }

    // Message d’attente
    const sentMsg = await sock.sendMessage(from, {
      text: "> SIGMA MDX DEPLOY : Préparation de la réponse vocale..."
    }, { quoted: msg });

    // Appel API
    const apiUrl = `https://apis.davidcyriltech.my.id/ai/chatbot?query=${encodeURIComponent(query)}`;
    const { data } = await axios.get(apiUrl);

    if (!data.success || !data.result) {
      throw new Error("Aucune réponse obtenue.");
    }

    // ======= TTS (voix française féminine) =======
    const tts = gTTS("fr"); 
    const tempDir = "./temp";
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const audioPath = path.join(tempDir, `SIGMA MDX_voice_${Date.now()}.mp3`);

    tts.save(audioPath, data.result, async () => {
      try {
        await sock.sendMessage(from, {
          audio: fs.readFileSync(audioPath),
          mimetype: "audio/mpeg",
          ptt: true
        }, { quoted: sentMsg });
      } finally {
        fs.existsSync(audioPath) && fs.unlinkSync(audioPath);
      }
    });

  } catch (err) {
    console.error("? Erreur commande SIGMA MDX :", err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: `> SIGMA MDX DEPLOY: ❌ Erreur : ${err.message}`
    }, { quoted: msg });
  }
}
