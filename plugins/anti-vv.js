const { cmd } = require("../command");

cmd({
  pattern: "vv",
  alias: ["viewonce", 'retrive', "😂"],
  react: '👀',
  desc: "Owner Only - retrieve quoted view once message",
  category: "owner",
  filename: __filename
}, async (client, message, match, { from, isOwner }) => {
  try {
    if (!isOwner) {
      return await client.sendMessage(from, {
        text: "*📛 This is an owner command.*\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ"
      }, { quoted: message });
    }

    if (!match.quoted) {
      return await client.sendMessage(from, {
        text: "*🍁 Please reply to a view once message!*"
      }, { quoted: message });
    }

    // Extraire le vrai message s'il est encapsulé dans viewOnce
    const viewOnce = match.quoted.message?.viewOnceMessage?.message;
    const msgContent = viewOnce || match.quoted.message;
    const msgType = Object.keys(msgContent || {})[0];
    const media = msgContent?.[msgType];

    if (!["imageMessage", "videoMessage", "audioMessage"].includes(msgType)) {
      return await client.sendMessage(from, {
        text: "❌ Only image, video, and audio messages are supported."
      }, { quoted: message });
    }

   // by crazy
    const buffer = await client.downloadMediaMessage({ message: msgContent });

    let messageContent = {};
    switch (msgType) {
      case "imageMessage":
        messageContent = {
          image: buffer,
          caption: media.caption || '',
          mimetype: media.mimetype || "image/jpeg"
        };
        break;
      case "videoMessage":
        messageContent = {
          video: buffer,
          caption: media.caption || '',
          mimetype: media.mimetype || "video/mp4"
        };
        break;
      case "audioMessage":
        messageContent = {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: media.ptt || false
        };
        break;
    }

    await client.sendMessage(from, messageContent, { quoted: message });

  } catch (error) {
    console.error("vv Error:", error);
    await client.sendMessage(from, {
      text: "❌ Error fetching view once message:\n" + error.message
    }, { quoted: message });
  }
});
