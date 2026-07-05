import { downloadMediaMessage } from "@whiskeysockets/baileys";

export const name = "gstatus";

const SITE_LINK = "https://sigmamdx.site";
const footer = () => `\n\n🌐 ${SITE_LINK}`;

const getBareNumber = (input) => {
  if (!input) return "";
  return String(input).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
};

export async function execute(sock, m, args) {
  const jid = m.key.remoteJid;

  try {
    if (!jid.endsWith("@g.us")) {
      await sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY : ❌ Cette commande fonctionne uniquement dans un groupe." },
        { quoted: m }
      );
      return;
    }

    // Message cible : direct ou cité
    let targetMessage = m;
    if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = m.message.extendedTextMessage.contextInfo;
      targetMessage = {
        key: {
          remoteJid: jid,
          id: quoted.stanzaId,
          participant: quoted.participant,
        },
        message: quoted.quotedMessage,
      };
    }

    const mediaMsg =
      targetMessage.message?.imageMessage ||
      targetMessage.message?.videoMessage;

    const caption =
      args.join(" ") ||
      targetMessage.message?.imageMessage?.caption ||
      targetMessage.message?.videoMessage?.caption ||
      "";

    if (!mediaMsg && !caption) {
      await sock.sendMessage(
        jid,
        {
          text:
            "> SIGMA MDX DEPLOY : 📸 Réponds à une image/vidéo avec `.gstatus`, ou envoie `.gstatus <texte>` pour un statut texte.\n" +
            "> Le statut sera visible uniquement par les membres de ce groupe."
        },
        { quoted: m }
      );
      return;
    }

    // Récupération des membres du groupe (audience du statut)
    const groupMeta = await sock.groupMetadata(jid);
    const botBare = getBareNumber(sock.user?.id);
    const statusJidList = groupMeta.participants
      .map((p) => p.id)
      .filter((id) => getBareNumber(id) !== botBare);

    if (statusJidList.length === 0) {
      await sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY : ❌ Impossible de récupérer les membres du groupe." },
        { quoted: m }
      );
      return;
    }

    const sendOpts = { statusJidList, backgroundColor: "#0a0d0f", font: 4 };

    if (mediaMsg?.mimetype?.startsWith("image")) {
      const buffer = await downloadMediaMessage(
        targetMessage,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );
      await sock.sendMessage(
        "status@broadcast",
        { image: buffer, caption: caption ? `${caption}${footer()}` : undefined },
        sendOpts
      );
    } else if (mediaMsg?.mimetype?.startsWith("video")) {
      const buffer = await downloadMediaMessage(
        targetMessage,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );
      await sock.sendMessage(
        "status@broadcast",
        { video: buffer, caption: caption ? `${caption}${footer()}` : undefined },
        sendOpts
      );
    } else {
      await sock.sendMessage(
        "status@broadcast",
        { text: `${caption}${footer()}` },
        sendOpts
      );
    }

    await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });
    await sock.sendMessage(
      jid,
      {
        text: `> SIGMA MDX DEPLOY : ✅ Statut publié — visible par les ${statusJidList.length} membre(s) de ce groupe.`
      },
      { quoted: m }
    );
  } catch (e) {
    console.error("❌ Erreur gstatus.js :", e);
    await sock.sendMessage(
      jid,
      { text: `> SIGMA MDX DEPLOY : ❌ Erreur gstatus : ${e.message}` },
      { quoted: m }
    );
  }
}
