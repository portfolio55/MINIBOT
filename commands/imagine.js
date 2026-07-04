import axios from "axios";

export const name = "imagine";
export const description = "Genere une image a partir d'un prompt via AI";
export const category = "AI";

async function generateImage(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
  const response = await axios.get(url, {
    params: { width: 1024, height: 1024, nologo: true },
    responseType: "arraybuffer",
    timeout: 40000
  });
  return Buffer.from(response.data);
}

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const rawText = args.join(" ").trim() ||
                    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim() ||
                    '';

    if (!rawText) {
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY: Exemple : .imagine un coucher de soleil sur les montagnes`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(from, { text: "🎨 Generation de l'image en cours..." }, { quoted: msg });

    const prompt = enhancePrompt(rawText);
    let imageBuffer = null;

    try {
      imageBuffer = await generateImage(prompt);
      if (!imageBuffer || imageBuffer.length < 1000) imageBuffer = null;
    } catch (e) {
      console.log("Imagine Pollinations failed:", e?.message);
    }

    if (!imageBuffer) {
      return await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY: Impossible de generer l'image. Reessayez plus tard.`
      }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      image: imageBuffer,
      caption: `> +---- SIGMA MDX DEPLOY ----+\n> Imagine : ${rawText}\n> +----------------+`
    }, { quoted: msg });

  } catch (error) {
    console.error("Erreur Imagine:", error);
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY: ❌ Impossible de generer l'image. Reessayez plus tard.`
    }, { quoted: msg });
  }
}

function enhancePrompt(prompt) {
  const qualityEnhancers = [
    "high quality", "detailed", "masterpiece", "best quality",
    "ultra realistic", "4k", "highly detailed",
    "professional photography", "cinematic lighting", "sharp focus"
  ];

  const numEnhancers = Math.floor(Math.random() * 2) + 3;
  const selectedEnhancers = qualityEnhancers
    .sort(() => Math.random() - 0.5)
    .slice(0, numEnhancers);

  return `${prompt}, ${selectedEnhancers.join(", ")}`;
}
