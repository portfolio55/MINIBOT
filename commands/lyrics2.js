export const name = "lyrics2";
export const description = "Get song lyrics";

export async function execute(sock, m, args) {
  try {
    const jid = m.key.remoteJid;

    if (!args.length || !args.join(" ").includes("|")) {
      return sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY ?? Usage: .lyrics artist | song" },
        { quoted: m }
      );
    }

    const [artist, title] = args.join(" ").split("|").map(v => v.trim());

    const url = `https://lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.lyrics) {
      return sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY ? Lyrics not found." },
        { quoted: m }
      );
    }

    const lyrics = data.lyrics.length > 3500
      ? data.lyrics.slice(0, 3500) + "\n\n[...truncated]"
      : data.lyrics;

    await sock.sendMessage(
      jid,
      {
        text:
`⚡ *Lyrics Found*

?? Artist: ${artist}
🎵 Song: ${title}

${lyrics}`
      },
      { quoted: m }
    );

  } catch (e) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: `? SIGMA MDX DEPLOY Lyrics Error: ${e.message}` },
      { quoted: m }
    );
  }
}