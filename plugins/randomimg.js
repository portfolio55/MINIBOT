const { cmd } = require("../command");
const axios = require("axios");

cmd({
    pattern: "rdanime",
    alias: ["randomanime"],
    desc: "Get a random anime.",
    category: "random",
    react: "🎥",
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    try {
        // Requête à l'API pour obtenir un anime aléatoire
        const response = await axios.get("https://api.jikan.moe/v4/random/anime");

        // Extraire les données de l'anime
        const anime = response.data.data;
        const animeTitle = anime.title;
        const animeImage = anime.images.jpg.large_image_url;
        const animeSynopsis = anime.synopsis || "No synopsis available for this anime.";
        const animeEpisodes = anime.episodes || "N/A";  // Nombre d'épisodes
        const animeStatus = anime.status || "Status not available"; // Statut de l'anime (en cours, terminé, etc.)

        // Préparer la réponse avec les informations de l'anime
        const message = `🎥 *Random Anime:* \n\n*Title:* ${animeTitle} \n*Synopsis:* ${animeSynopsis} \n*Episodes:* ${animeEpisodes} \n*Status:* ${animeStatus}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ`;

        // Envoyer le message avec l'image et les informations supplémentaires
        await conn.sendMessage(m.chat, {
            image: { url: animeImage },
            caption: message
        }, { quoted: mek });
    } catch (error) {
        console.error(error);
        reply("⚠️ *An error occurred while fetching the anime. Please try again later.*");
    }
});


cmd({
  pattern: "rw",
  alias: ["randomwall", "wallpaper"],
  react: "🌌",
  desc: "Download random wallpapers based on keywords.",
  category: "random",
  use: ".rw <keyword>",
  filename: __filename
}, async (conn, m, store, { from, args, reply }) => {
  try {
    const query = args.join(" ") || "random";
    const apiUrl = `https://pikabotzapi.vercel.app/random/randomwall/?apikey=anya-md&query=${encodeURIComponent(query)}`;

    const { data } = await axios.get(apiUrl);
    
    if (data.status && data.imgUrl) {
      const caption = `🌌*Random Wallpaper*: ${query}\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ ꜱɪɢᴍᴀ  `;
      await conn.sendMessage(from, { image: { url: data.imgUrl }, caption }, { quoted: m });
    } else {
      reply(`❌ No wallpaper found for *"${query}"*.`);
    }
  } catch (error) {
    console.error("Wallpaper Error:", error);
    reply("❌ An error occurred while fetching the wallpaper. Please try again.");
  }
});
