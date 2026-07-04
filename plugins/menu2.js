
const { getContextInfo } = require('./new');
const config = require('../config');
const { cmd, commands } = require('../command');


cmd({
    pattern: "menu2",
    react: "📜",
    desc: "get cmd list",
    category: "main",
    filename: __filename
}, async (conn, mek, m, {
    from, quoted, body, isCmd, command, args, q,
    isGroup, sender, senderNumber, botNumber2, botNumber,
    pushname, isMe, isOwner, groupMetadata, groupName,
    participants, groupAdmins, isBotAdmins, isAdmins, reply
}) => {
    try {
        let menu = {
            main: '',
            download: '',
            group: '',
            owner: '',
            anime: '',
            othere: '',
            convert: '',
            settings: '',
            ai: '',
            search: ''
        };

        for (let i = 0; i < commands.length; i++) {
            if (commands[i].pattern && !commands[i].dontAddCommandList) {
                menu[commands[i].category] += `*┋* ${commands[i].pattern}\n`;
            }
        }

        let madeMenu = `
╔═❖「 *${config.BOT_NAME}* 」❖╗
║  Hello, *${pushname}*  
║ ᴘʟᴜɢɪɴꜱ: *${commands.length}*  
║ ᴘʀᴇꜰɪx: *${config.PREFIX}*
║ ᴍᴏᴅᴇ: [${config.MODE}]
║ ᴠᴇʀꜱɪᴏɴ: *1.0.5*
║ ᴅᴇᴠᴇʟᴏᴘᴇʀ: *ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ*
╚═════════════════╝

╔═✦『 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 』✦╗
${menu.download}
╚════════════════╝

╔═══✦『 𝐀𝐈 𝐌𝐍 』✦═══╗
${menu.ai}
╚═════════════════╝

╔═══✦『 𝐌𝐀𝐈𝐍 』✦═══╗
${menu.main}
╚═════════════════╝

╔═══✦『 𝐆𝐑𝐎𝐔𝐏 』✦══╗
${menu.group}
╚═════════════════╝

╔══✦『 𝐎𝐖𝐍𝐄𝐑 』✦══╗
${menu.owner}
╚════════════════╝

╔═══✦『 𝐎𝐓𝐇𝐄𝐑𝐒 』✦═══╗
${menu.othere}
╚═════════════════╝

╔═══✦『 𝐀𝐍𝐈𝐌𝐄 』✦═══╗
${menu.anime}
╚═════════════════╝

╔═✦『 𝐂𝐎𝐍𝐕𝐄𝐑𝐓𝐄𝐑 』✦╗
${menu.convert}
╚═════════════════╝

╔═══✦『 𝐒𝐄𝐀𝐑𝐂𝐇 』✦═╗
${menu.search}
╚═════════════════╝ 

╔══✦『 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒 』✦═╗
${menu.settings}
╚═════════════════╝
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ
`;

        await conn.sendMessage(
            from,
            {
                image: { url: config.MENU_IMG },
                caption: madeMenu,
                contextInfo: getContextInfo(m.sender)
            },
            { quoted: mek }
        );

    } catch (e) {
        console.log(e);
        reply(`${e}`);
    }
});
