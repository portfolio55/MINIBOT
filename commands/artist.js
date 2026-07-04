export const name = "artist";

// TheAudioDB free public test key ("2") - no registration required.
const AUDIODB_KEY = "2";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    if (!args.length) {
      await sock.sendMessage(from, {
        text: "> 🎨 SIGMA MDX DEPLOY : Usage: !artist <nom>\nEx: !artist Ed Sheeran"
      }, { quoted: msg });
      return;
    }

    const artist = args.join(" ");
    const url = `https://www.theaudiodb.com/api/v1/json/${AUDIODB_KEY}/search.php?s=${encodeURIComponent(artist)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data?.artists || !data.artists.length) {
      await sock.sendMessage(from, { text: "> ❌ SIGMA MDX DEPLOY : Artiste non trouvé." }, { quoted: msg });
      return;
    }

    const a = data.artists[0];

    const reply = `> 🎨 SIGMA MDX DEPLOY : ${a.strArtist}
🎨🎨🎨🎨🎨🎨
📅 Formé en: ${a.intFormedYear || "N/A"}
🎵 Style: ${a.strStyle || a.strGenre || "N/A"}
👥 Followers: ${a.intFollowers ? parseInt(a.intFollowers).toLocaleString() : "N/A"}
🌍 Pays: ${a.strCountry || "N/A"}
📖 Bio: ${(a.strBiographyEN || "N/A").substring(0, 250)}...
🔗 Site: ${a.strWebsite ? `https://${a.strWebsite}` : "N/A"}`;

    if (a.strArtistFanart || a.strArtistThumb) {
      await sock.sendMessage(from, {
        image: { url: a.strArtistFanart || a.strArtistThumb },
        caption: reply
      }, { quoted: msg });
    } else {
      await sock.sendMessage(from, { text: reply }, { quoted: msg });
    }

  } catch (err) {
    console.error("Erreur artist :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service artistes indisponible." }, { quoted: msg });
  }
}
