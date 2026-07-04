export const name = "podcast";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      await sock.sendMessage(from, { 
        text: "> 🎨 SIGMA MDX DEPLOY : Usage: !podcast <sujet>\nEx: !podcast intelligence artificielle" 
      }, { quoted: msg });
      return;
    }
    
    const topic = args.join(" ");
    
    // API ElevenLabs (TTS)
    const API_KEY = "TON_API_KEY";
    if (API_KEY === "TON_API_KEY" || API_KEY === "YOUR_API_KEY") {
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY: ❌ Cette commande nécessite une clé API non configurée.\nContactez l'administrateur."
      }, { quoted: msg });
      return;
    }
    const voice_id = "21m00Tcm4TlvDq8ikWAM";
    const text = `Bonjour, aujourd'hui nous parlons de ${topic}.`;
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });
    
    const audioBuffer = await response.arrayBuffer();
    
    await sock.sendMessage(from, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      caption: `> 🎨 SIGMA MDX DEPLOY : Podcast\nSujet: ${topic}`
    }, { quoted: msg });
    
  } catch (err) {
    console.error("Erreur podcast :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service podcast indisponible." }, { quoted: msg });
  }
}