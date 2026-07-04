import axios from "axios";

export const name = "anime-stick";
export const description = "Generate animated text sticker";
export const category = "Sticker";

const GIFTED_TTP_ENDPOINT = "https://api.gifted.co.ke/api/tools/ttp";
const GIFTED_API_KEY = process.env.GIFTED_API_KEY || "gifted";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  if (!args || args.length === 0) {
    return await sock.sendMessage(from, {
      text: "⚡ *SIGMA MDX DEPLOY ATTP*\n\n" +
            "Usage: .attp <text>\n" +
            "Example: .attp Hello World\n\n" +
            "Generates a text sticker from text"
    }, { quoted: msg });
  }

  const text = args.join(' ');

  if (text.length > 50) {
    return await sock.sendMessage(from, {
      text: "❎ *SIGMA MDX DEPLOY*: Text too long\n" +
            "Maximum 50 characters"
    }, { quoted: msg });
  }

  try {
    const sentMsg = await sock.sendMessage(from, {
      text: "⏳ *SIGMA MDX DEPLOY* - Creating sticker..."
    }, { quoted: msg });

    // NOTE: Gifted API does not currently expose a dedicated animated
    // text-to-sticker (attp) endpoint, so we use its text-to-picture (ttp)
    // endpoint. The result is a static image sticker rather than animated.
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
    console.error("ATTP Error:", err?.message || err);
    await sock.sendMessage(from, {
      text: "❎ *SIGMA MDX DEPLOY*: Failed to generate sticker\n" +
            "API might be temporarily unavailable"
    }, { quoted: msg });
  }
}
