const { cmd } = require('../command');
const config = require("../config");

// Anti-Bad Words System
cmd({
  'on': "body"
}, async (conn, m, store, {
  from,
  body,
  isGroup,
  isAdmins,
  isBotAdmins,
  reply,
  sender
}) => {
  try {
    const badWords = ["wtf", "mia", "xxx", "fuck", 'sex', "huththa", "pakaya", 'ponnaya', "hutto"];

    if (!isGroup || isAdmins || !isBotAdmins) {
      return;
    }

    const messageText = body.toLowerCase();
    const containsBadWord = badWords.some(word => messageText.includes(word));

    if (containsBadWord && config.ANTI_BAD_WORD === "true") {
      await conn.sendMessage(from, { 'delete': m.key }, { 'quoted': m });
      await conn.sendMessage(from, { 'text': "⚠️ BAD WORDS NOT ALLOWED ⚠️ " }, { 'quoted': m });
    }
  } catch (error) {
    console.error(error);
    reply("An error occurred while processing the message.");
  }
});

// Anti-Link System
cmd({
  on: "body"
}, async (conn, m, store, {
  from,
  body,
  sender,
  isGroup,
  isAdmins,
  isBotAdmins,
  reply
}) => {
  try {
    if (!isGroup || isAdmins || !isBotAdmins || config.ANTI_LINK !== "true") return;

    const messageText = body.toLowerCase();

    // Match all URLs
    const linkRegex = /https?:\/\/[^\s]+/gi;
    const containsLink = linkRegex.test(messageText);

    if (containsLink) {
      await conn.sendMessage(from, { delete: m.key });
      await conn.sendMessage(from, {
        text: `⚠️ Links are not allowed here!\n@${sender.split('@')[0]}, your message has been deleted.`,
        mentions: [sender]
      }, { quoted: m });
    }

  } catch (error) {
    console.error(error);
    reply("An error occurred while processing the message.");
  }
});