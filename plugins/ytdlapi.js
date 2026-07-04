const config = require('../config');
const { cmd } = require('../command');
const { ytsearch } = require('@dark-yasiya/yt-dl.js');

// MP4 video download
// MP4 video download with options
cmd({ 
    pattern: "video", 
    alias: ["mp4"], 
    react: "🎥", 
    desc: "Download YouTube video", 
    category: "download", 
    use: '.mp4 < Yt url or Name >', 
    filename: __filename 
}, async (conn, mek, m, { from, prefix, quoted, q, reply }) => { 
    try { 
        if (!q) return await reply("Please provide a YouTube URL or song name.");
        
        const yt = await ytsearch(q);
        if (yt.results.length < 1) return reply("No results found!");
        
        let yts = yt.results[0];  
        let apiUrl = `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(yts.url)}`;
        
        let response = await fetch(apiUrl);
        let data = await response.json();
        
        if (data.status !== 200 || !data.success || !data.result.download_url) {
            return reply("Failed to fetch the video. Please try again later.");
        }

let ytmsg = `
╭━━〔 *Video Details* 〕━━╮
│
│ •  🎬 *Title:* ${yts.title}
│ •  ⏳ *Duration:* ${yts.timestamp}
│ •  👀 *Views:* ${yts.views}
│ •  👤 *Author:* ${yts.author.name}
│ •  🔗 *Link:* ${yts.url}
│
│ *Choose download format:*
│
│ 1. 📄 Document 
│ 2. ▶️ Normal Video 
│
╰─ _Reply with 1 or 2 to download_ ─╯
`;

        let contextInfo = {
            mentionedJid: [m.sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363415909557904@newsletter',
                newsletterName: 'SIGMA MD',
                serverMessageId: 143
            }
        };

        // Send thumbnail with options
        const videoMsg = await conn.sendMessage(from, { image: { url: yts.thumbnail }, caption: ytmsg,contextInfo }, { quoted: mek });

        conn.ev.on("messages.upsert", async (msgUpdate) => {
            const replyMsg = msgUpdate.messages[0];
            if (!replyMsg.message || !replyMsg.message.extendedTextMessage) return;

            const selected = replyMsg.message.extendedTextMessage.text.trim();

            if (
                replyMsg.message.extendedTextMessage.contextInfo &&
                replyMsg.message.extendedTextMessage.contextInfo.stanzaId === videoMsg.key.id
            ) {
                await conn.sendMessage(from, { react: { text: "⬇️", key: replyMsg.key } });

                switch (selected) {
                    case "1":
                        await conn.sendMessage(from, {
                            document: { url: data.result.download_url },
                            mimetype: "video/mp4",
                            fileName: `${yts.title}.mp4`,
                            contextInfo
                        }, { quoted: replyMsg });
                        break;

                    case "2":
                        await conn.sendMessage(from, {
                            video: { url: data.result.download_url },
                            mimetype: "video/mp4",
                            contextInfo
                        }, { quoted: replyMsg });
                        break;

                    default:
                        await conn.sendMessage(
                            from,
                            { text: "*Please Reply with ( 1 , 2 or 3) ❤️" },
                            { quoted: replyMsg }
                        );
                        break;
                }
            }
        });

    } catch (e) {
        console.log(e);
        reply("An error occurred. Please try again later.");
    }
});

// MP3 song download
cmd({ 
    pattern: "song", 
    alias: ["ytdl3", "play"], 
    react: "🎶", 
    desc: "Download YouTube song", 
    category: "download", 
    use: '.song < Yt url or Name >', 
    filename: __filename 
}, async (conn, mek, m, { from, prefix, quoted, q, reply }) => { 
    try { 
        if (!q) return await reply("Please provide a YouTube URL or song name.");
        
        const yt = await ytsearch(q);
        if (yt.results.length < 1) return reply("No results found!");
        
        let yts = yt.results[0];  
        let apiUrl = `https://apis.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(yts.url)}`;
        
        let response = await fetch(apiUrl);
        let data = await response.json();
        
        if (data.status !== 200 || !data.success || !data.result.downloadUrl) {
            return reply("Failed to fetch the audio. Please try again later.");
        }
        
let ytmsg = `
╭━━〔 *Song Details* 〕━━╮
│
│ •  🎬 *Title:* ${yts.title}
│ •  ⏳ *Duration:* ${yts.timestamp}
│ •  👀 *Views:* ${yts.views}
│ •  👤 *Author:* ${yts.author.name}
│ •  🔗 *Link:* ${yts.url}
│
│ *Choose download format:*
│
│ 1. 📄 Document 
│ 2. ▶️ Normal audio
│ 3  🎙️  voicemail  
│
╰─ _Reply with 1 or 2 to download_ ─╯
`;
        let contextInfo = {
            mentionedJid: [m.sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363322606369079@newsletter',
                newsletterName: 'PRINCE TECH',
                serverMessageId: 143
            }
        };
        
        // Send thumbnail with caption only
  const songmsg = await conn.sendMessage(from, { image: { url: yts.thumbnail }, caption: ytmsg,contextInfo }, { quoted: mek });

  
     
                     conn.ev.on("messages.upsert", async (msgUpdate) => {
        

                const mp3msg = msgUpdate.messages[0];
                if (!mp3msg.message || !mp3msg.message.extendedTextMessage) return;

                const selectedOption = mp3msg.message.extendedTextMessage.text.trim();

                if (
                    mp3msg.message.extendedTextMessage.contextInfo &&
                    mp3msg.message.extendedTextMessage.contextInfo.stanzaId === songmsg.key.id
                ) {
                
                            
                   await conn.sendMessage(from, { react: { text: "⬇️", key: mp3msg.key } });

                    switch (selectedOption) {
case "1":   

      
      
   await conn.sendMessage(from, { document: { url: data.result.downloadUrl }, mimetype: "audio/mpeg", fileName: `${yts.title}.mp3` }, { quoted: mp3msg });   
      
      
break;
case "2":   
await conn.sendMessage(from, { audio: { url: data.result.downloadUrl }, mimetype: "audio/mpeg" }, { quoted: mp3msg });
break;
case "3":   
await conn.sendMessage(from, { audio: { url: data.result.downloadUrl }, mimetype: "audio/mpeg", ptt: true }, { quoted: mp3msg });
break;


default:
                            await conn.sendMessage(
                                from,
                                {
                                    text: "*invalid selection please select between ( 1 or 2 or 3) 🔴*",
                                },
                                { quoted: mp3msg }
                            );
             }}});
           
    } catch (e) {
        console.log(e);
        reply("An error occurred. Please try again later.");
    }
});
