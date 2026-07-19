const { Bot, InlineKeyboard, InputFile } = require("grammy");
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const fs = require("fs");

const bot = new Bot("8675187156:AAFoeJ3kuy9y95RDwi463o3RUkZQSnpvcF8");
const CHANNEL_USERNAME = "@airdrop_huntersbd2025"; 
const userSessions = {}; 

async function checkSubscription(userId) {
    try {
        const member = await bot.api.getChatMember(CHANNEL_USERNAME, userId);
        return ["creator", "administrator", "member"].includes(member.status);
    } catch (e) { return false; }
}

async function connectToWhatsApp(chatId) {
    if (!userSessions[chatId]) {
        userSessions[chatId] = { isWaConnected: false, msgSent: false, qrSentTime: 0 };
    }

    const { state, saveCreds } = await useMultiFileAuthState(`auth_${chatId}`);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sajib Validator", "Chrome", "1.0.0"]
    });

    userSessions[chatId].sock = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr && !userSessions[chatId].isWaConnected) {
            const qrPath = `qr_${chatId}.png`;
            await QRCode.toFile(qrPath, qr);
            await bot.api.sendPhoto(chatId, new InputFile(qrPath), { caption: "📸 কিউআর কোড স্ক্যান করুন" });
            if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
        }

        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => connectToWhatsApp(chatId), 2000);
            }
        } else if (connection === 'open') {
            userSessions[chatId].isWaConnected = true;
            if (!userSessions[chatId].msgSent) {
                await bot.api.sendMessage(chatId, "✅ কানেক্টেড!");
                userSessions[chatId].msgSent = true;
            }
        }
    });
}

const menu = {
    keyboard: [
        [{ text: "📱 Link WhatsApp (QR)" }, { text: "🔍 Start Checking" }],
        [{ text: "⚙️ Check My Connection" }, { text: "📖 Rules / How to use" }],
        [{ text: "👨‍💻 Admin / Support" }]
    ],
    resize_keyboard: true
};

bot.command("start", async (ctx) => {
    const isSub = await checkSubscription(ctx.from.id);
    if (!isSub) return ctx.reply("চ্যানেলে জয়েন করুন!");
    ctx.reply("স্বাগতম সজীব ভাই!", { reply_markup: menu });
});

bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id;

    if (text === "📱 Link WhatsApp (QR)") connectToWhatsApp(chatId);
    else if (text === "🔍 Start Checking") ctx.reply("নম্বর পাঠান (কান্ট্রি কোডসহ):");
    else if (text.length > 5 && userSessions[chatId]?.isWaConnected) {
        const [result] = await userSessions[chatId].sock.onWhatsApp(text.replace(/\D/g, ""));
        ctx.reply(result?.exists ? "🟢 " + text + " (Active)" : "🔴 " + text + " (Inactive)");
    }
});

bot.start();
