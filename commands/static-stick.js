import axios from "axios";

export const name = "static-stick";
export const description = "Generate text sticker (static)";
export const category = "Sticker";

const GIFTED_TTP_ENDPOINT = "https://api.gifted.co.ke/api/tools/ttp";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  if (!args || args.length === 0) {
    return await sock.sendMessage(from, {
      text: "⚡ *SIGMA MDX DEPLOY TTP*\n\n" +
            "Usage: .ttp <text>\n" +
            "Example: .ttp Hello World\n\n" +
            "Creates a text sticker (static image)"
    }, { quoted: msg });
  }

  const text = args.join(' ');

  if (text.length > 50) {
    return await sock.sendMessage(from, {
      text: "❎ *SIGMA MDX DEPLOY*: Text too long\n" +
            "Maximum 50 characters for best results"
    }, { quoted: msg });
  }

  try {
    const sentMsg = await sock.sendMessage(from, {
      text: "⏳ *SIGMA MDX DEPLOY* - Creating text sticker..."
    }, { quoted: msg });

    const { data } = await axios.get(GIFTED_TTP_ENDPOINT, {
      params: { apikey: GIFTED_API_KEY, query: text },
      timeout: 30000
    });

    const imageUrl = data?.image_url || data?.result?.image_url;
    if (!data?.success || !imageUrl) {
      throw new Error("No image returned from Gifted API");
    }

    await sock.sendMessage(from, {
      sticker: { url: imageUrl },
      mimetype: 'image/png'
    }, { quoted: sentMsg });

  } catch (err) {
    console.error("TTP Error:", err?.message || err);
    await sock.sendMessage(from, {
      text: "❎ *SIGMA MDX DEPLOY*: Failed to generate text sticker\n" +
            "Try again with shorter text"
    }, { quoted: msg });
  }
}
