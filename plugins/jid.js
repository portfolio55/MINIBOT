const { cmd } = require('../command');

cmd({
    pattern: "jid",
    desc: "Get the JID of the user or group.",
    react: "📍",
    category: "group",
    filename: __filename,
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        // Ensure the command is being used in a group or personal chat and the user has necessary permissions
        if (!isGroup && !isOwner) {
            return reply("⚠️ Only the bot owner or group admins can use this command.");
        }

        // If the message is from a group
        if (isGroup) {
            // Respond with the group JID
            return reply(`*ɢʀᴏᴜᴘ ᴊɪᴅ:* *${from}*`);
        }

        // If it's a personal chat, respond with the user's JID
        if (!isGroup) {
            return reply(`User JID: *${sender}*`);
        }

    } catch (e) {
        console.error("Error:", e);
        reply(`❌ An error occurred: ${e.message}`);
    }
});
