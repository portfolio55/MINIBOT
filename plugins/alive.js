
const { cmd } = require("../command");
const moment = require("moment");

let botStartTime = Date.now(); // Enregistrement de l'heure de démarrage du bot
const ALIVE_IMG = "https://files.catbox.moe/zpg9wv.jpg"; // Assurez-vous que cette URL est valide

cmd({
    pattern: "alive",
    desc: "Check if the bot is active.",
    category: "main",
    react: "💡",
    filename: __filename
}, async (conn, mek, m, { reply, from }) => {
    try {
        const pushname = m.pushName || "User"; // Nom de l'utilisateur ou valeur par défaut
        const currentTime = moment().format("HH:mm:ss");
        const currentDate = moment().format("dddd, MMMM Do YYYY");

        const runtimeMilliseconds = Date.now() - botStartTime;
        const runtimeSeconds = Math.floor((runtimeMilliseconds / 1000) % 60);
        const runtimeMinutes = Math.floor((runtimeMilliseconds / (1000 * 60)) % 60);
        const runtimeHours = Math.floor(runtimeMilliseconds / (1000 * 60 * 60));

        const formattedInfo = `
🌟 *SIGMA MDX STATUS* 🌟
Hi 🫵🏽 ${pushname}
> 🕒 *Time*: ${currentTime}
> 📅 *Date*: ${currentDate}
> ⏳ *Uptime*: ${runtimeHours} hours, ${runtimeMinutes} minutes, ${runtimeSeconds} seconds

> 🤖 *Status*: *ONLINE*

> 🎉 *Enjoy the Service!*
        `.trim();

        // Vérifier si l'image est définie
        if (!ALIVE_IMG || !ALIVE_IMG.startsWith("http")) {
            throw new Error("Invalid ALIVE_IMG URL. Please set a valid image URL.");
        }

        // Envoyer le message avec image et légende
        await conn.sendMessage(from, {
            image: { url: ALIVE_IMG }, // Assurez-vous que l'URL est valide
            caption: formattedInfo,
          
        }, { quoted: mek });
        
        // Send the audio file with context info
        await conn.sendMessage(from, {
            audio: { url: 'https://raw.githubusercontent.com/Mayelprince/url/main/url/Alan_Walker___Faded.mp3' },
            mimetype: 'audio/mp4',
            ptt: true,
           
        }, { quoted: mek });

    } catch (error) {
        console.error("Error in alive command: ", error);
        
        // Répondre avec des détails de l'erreur
        const errorMessage = `
❌ An error occurred while processing the alive command.
🛠 *Error Details*:
${error.message}

Please report this issue or try again later.
        `.trim();
        return reply(errorMessage);
    }
});
