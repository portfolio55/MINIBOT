// new.js

const getContextInfo = (sender) => ({
    mentionedJid: [sender],
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363415909557904@newsletter',
        newsletterName: 'SIGMA MD',
        serverMessageId: 999
    }
});

module.exports = { getContextInfo };
