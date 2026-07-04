export const name = "fact";
export const description = "Get a random useless fact";

export async function execute(sock, m, args) {
  try {
    const jid = m.key.remoteJid;

    const res = await fetch("https://uselessfacts.jsph.pl/random.json?language=en");
    const data = await res.json();

    if (!data || !data.text) {
      return await sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY ? Impossible de récupérer un fait." },
        { quoted: m }
      );
    }

    await sock.sendMessage(
      jid,
      { text: `⚡ SIGMA MDX DEPLOY Fact:\n\n${data.text}` },
      { quoted: m }
    );
  } catch (err) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: `? SIGMA MDX DEPLOY Fact Error: ${err.message}` },
      { quoted: m }
    );
  }
}