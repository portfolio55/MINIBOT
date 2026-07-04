const config = require('../config')
const { cmd, commands } = require('../command')
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson} = require('../lib/functions')

cmd({
    pattern: "tagall",
    react: "🔊",
    alias: ["gc_tagall"],
    desc: "To Tag all Members",
    category: "group",
    use: '.tagall [message]',
    filename: __filename
},
async (conn, mek, m, { from, participants, reply, isGroup, senderNumber, groupAdmins, prefix, command, args, body }) => {
    try {
        if (!isGroup) return reply("❌ This command can only be used in groups.");

        const botOwner = conn.user.id.split(":")[0];
        const senderJid = senderNumber + "@s.whatsapp.net";

        if (!groupAdmins.includes(senderJid) && senderNumber !== botOwner) {
            return reply("❌ Only group admins or the bot owner can use this command.");
        }

        let groupInfo = await conn.groupMetadata(from).catch(() => null);
        if (!groupInfo) return reply("❌ Failed to fetch group information.");

        let groupName = groupInfo.subject || "Unknown Group";
        let totalMembers = participants ? participants.length : 0;
        if (totalMembers === 0) return reply("❌ No members found in this group.");

        // Extract message
        let message = body.slice(body.indexOf(command) + command.length).trim();
        if (!message) message = "Hello everyone, please check this out!";

        // Build the formatted text
        let teks = `
╭━━〔 *Group Mention* 〕━━╮
│
│ • *Group:* ${groupName}
│ • *Members:* ${totalMembers}
│ • *Message:* ${message}
│
│───〔 *MENTIONS* 〕───
`;

        for (let mem of participants) {
            if (!mem.id) continue;
            teks += `│ ⤷ @${mem.id.split('@')[0]}\n`;
        }

        teks += "╰───⧈ SIGMA-MDX ⧈───╯";

        // Send the tag message
        await conn.sendMessage(from, {
            text: teks,
            mentions: participants.map(p => p.id)
        }, { quoted: mek });

    } catch (e) {
        console.error("TagAll Error:", e);
        reply(`❌ *Error Occurred !!*\n\n${e.message || e}`);
    }
});



cmd({
    pattern: "tag",
    react: "🔊",
    desc: "To tag all members with a message",
    category: "group",
    use: '.tag Hi',
    filename: __filename
}, async (conn, mek, m, { from, senderNumber, participants, q, reply }) => {
    try {
        // Get the bot owner's number dynamically from conn.user.id
        const botOwner = conn.user.id.split(":")[0]; // Extract the bot owner's number
        if (senderNumber !== botOwner) {
            return reply("Only the bot owner can use this command.");
        }

        if (!q) return reply('*Please provide a message to send.* ℹ️');

        conn.sendMessage(from, { text: q, mentions: participants.map(a => a.id), linkPreview: true }, { quoted: mek });

    } catch (e) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        console.log(e);
        reply(`❌ *Error Occurred !!*\n\n${e}`);
    }
});
