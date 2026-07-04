const { fetchJson } = require("../lib/functions");
const { downloadTiktok } = require("@mrnima/tiktok-downloader");
const { facebook } = require("@mrnima/facebook-downloader");
const cheerio = require("cheerio");
const { igdl } = require("ruhend-scraper");
const axios = require("axios");
const { cmd, commands } = require('../command');



cmd({
  pattern: "randomporn",
  alias: ["randomxvideos", "randporn","randxvideo","randxvideos"],
  desc: "Get a random adult video from the HentaiVid API",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, quoted, q, reply }) => {
  try {
    await conn.sendMessage(from, {
      react: { text: '🔍', key: m.key }
    });

    // Fetch random video from the API
    const response = await fetch('https://apis-keith.vercel.app/dl/hentaivid');
    const data = await response.json();

    if (!data.status || !data.result || data.result.length === 0) {
      return reply("❌ No videos found.");
    }

    // Select a random video from the result
    const video = data.result[Math.floor(Math.random() * data.result.length)];

    const { title, link, category, media, views_count } = video;
    const { video_url } = media;

    const caption = `╭════ 〔 *SIGMA MDX* 〕══❐\n`
      + `┃▸ *Title:* ${title}\n`
      + `┃▸ *Category:* ${category}\n`
      + `┃▸ *Views:* ${views_count}\n`
      + `╰═════════════════❐\n\n`
      + `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ\n`
      + `🔗 *Join our channel:* *https://tinyurl.com/SIGMAXW*`;

    // Send the video message with caption
    const sentMsg = await conn.sendMessage(from, {
      video: { url: video_url },
      caption: caption
    }, { quoted: m });

    const messageID = sentMsg.key.id;

    conn.ev.on("messages.upsert", async (msgData) => {
      const receivedMsg = msgData.messages[0];
      if (!receivedMsg.message) return;

      const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
      const senderID = receivedMsg.key.remoteJid;
      const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

      if (isReplyToBot) {
        await conn.sendMessage(senderID, {
          react: { text: '⬇️', key: receivedMsg.key }
        });

        // Check if the user wants to download
        if (receivedText.toLowerCase() === "download") {
          await conn.sendMessage(senderID, {
            video: { url: video_url },
            caption: `📥 *Download your requested video:* ${title}`
          }, { quoted: receivedMsg });
        } else {
          reply("❌ Invalid option! Please reply with *download* to get the video.");
        }
      }
    });

  } catch (error) {
    console.error("Error:", error);
    reply("❌ An error occurred while processing your request. Please try again.");
  }
});
