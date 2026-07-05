export const name = "removemembers";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const bare = (jid) => String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin).map(p => p.id);
    const nonAdmins = meta.participants.filter(p => !p.admin);
    if (nonAdmins.length === 0) {
      return await sock.sendMessage(from, { text: "❌ Aucun membre non-admin à retirer." });
    }
    const botBares = [bare(sock.user?.id), bare(sock.user?.lid)].filter(Boolean);
    const botIsAdmin = meta.participants.some(p => botBares.includes(bare(p.id)) && (p.admin === "admin" || p.admin === "superadmin" || p.admin));
    if (!botIsAdmin) {
      try {
        const adminList = meta.participants.filter(p => p.admin).map(p => ({ id: p.id, admin: p.admin }));
        const botParticipant = meta.participants.find(p => botBares.includes(bare(p.id)));
        console.log("[removemembers] bot not admin?", { botBares, botId: sock.user?.id, botLid: sock.user?.lid, found: botParticipant, admins: adminList.slice(0, 15) });
      } catch {}
      return await sock.sendMessage(from, { text: "❌ Le bot doit être admin." });
    }
    for (const p of nonAdmins) {
      try {
        await sock.groupParticipantsUpdate(from, [p.id], "remove");
        await sleep(1500);
      } catch (e) {
        console.warn("remove:", e?.message);
      }
    }
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (e) {
    console.error("Erreur removemembers:", e);
    await sock.sendMessage(from, { text: "❌ Erreur lors du retrait." });
  }
}
