
const {getContextInfo} = require('./new')
const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

cmd({
    pattern: "play2",
    desc: "To download songs.",
    react: "🎵",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, pushname }) => {
    try {
        if (!q) return reply("Please give me a url or title");
        const search = await yts(q);
        const data = search.videos[0];
        const url = data.url;

        let desc = `
*⦁ MUSⵊC DOWNLOADⵊNG ⦁*

🎵 *MUSⵊC FOUND!* 

➥ *Title:* ${data.title} 
➥ *Duration:* ${data.timestamp} 
➥ *Views:* ${data.views} 
➥ *Uploaded On:* ${data.ago} 
➥ *Link:* ${data.url} 

🎧 *ENJOY THE MUSIC BROUGHT TO YOU!*

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ*
`;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: desc, contextInfo: getContextInfo(m.sender)             }, { quoted: mek });

        const res = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${url}`);
        const audio = res.data.result.downloadUrl;

        await conn.sendMessage(from, { audio: { url: audio }, mimetype: "audio/mpeg" }, { quoted: mek });
    } catch (e) {
        console.log(e);
        reply(`_Hi ${pushname}, retry later_`);
    }
});

cmd({
    pattern: "playdoc2",
    desc: "To download song as document with info preview.",
    react: "📄",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, pushname }) => {
    try {
        if (!q) return reply("Please give me a url or title");

        const search = await yts(q);
        const data = search.videos[0];
        const url = data.url;

        const res = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${url}`);
        const audio = res.data.result.downloadUrl;

        let caption = `
*⦁ MUSⵊC DOWNLOADⵊNG ⦁*

🎵 *MUSⵊC FOUND!* 

➥ *Title:* ${data.title} 
➥ *Duration:* ${data.timestamp} 
➥ *Views:* ${data.views} 
➥ *Uploaded On:* ${data.ago} 
➥ *Link:* ${data.url} 

🎧 *ENJOY THE MUSIC BROUGHT TO YOU!*

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ*
`;

        // 1. Send music preview with thumbnail
        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption: caption,
            contextInfo: getContextInfo(m.sender)  
        }, { quoted: mek });

        // 2. Send audio file as document with the same caption
        await conn.sendMessage(from, {
            document: { url: audio },
            mimetype: "audio/mpeg",
            fileName: `${data.title}.mp3`,
            caption: " ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ "
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(`_Hi ${pushname}, retry later_`);
    }
});