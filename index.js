const { Bot, InlineKeyboard, Keyboard, InputFile } = require("grammy");
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
        const status = member.status;
        return ["creator", "administrator", "member"].includes(status);
    } catch (error) {
        console.log(`Subscription Check Error for ${userId}`);
        return false; 
    }
}

async function connectToWhatsApp(chatId) {
    if (userSessions[chatId] && (userSessions[chatId].isWaConnected || userSessions[chatId].isConnecting)) return;

    if (!userSessions[chatId]) {
        userSessions[chatId] = { sock: null, isWaConnected: false, msgSent: false, isConnecting: true, qrSentTime: 0 };
    } else {
        userSessions[chatId].isConnecting = true;
    }

    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_${chatId}`);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sajib Validator Pro", "Chrome", "1.0.0"]
    });

    userSessions[chatId].sock = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && !userSessions[chatId].isWaConnected) {
            const now = Date.now();
            if (now - userSessions[chatId].qrSentTime > 45000) {
                userSessions[chatId].qrSentTime = now;
                try {
                    const qrPath = `qrcode_${chatId}.png`;
                    await QRCode.toFile(qrPath, qr);
                    await bot.api.sendPhoto(chatId, new InputFile(qrPath), { caption: "📸 আপনার QR কোড স্ক্যান করুন।" });
                    if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
                } catch (err) { console.log(err); }
            }
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            userSessions[chatId].isWaConnected = false;
            userSessions[chatId].isConnecting = false;
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(chatId), 2000);
        } else if (connection === 'open') {
            userSessions[chatId].isWaConnected = true;
            userSessions[chatId].isConnecting = false;
            if (!userSessions[chatId].msgSent) {
                await bot.api.sendMessage(chatId, "✅ সফলভাবে লিঙ্ক হয়েছে!");
                userSessions[chatId].msgSent = true; 
            }
        }
    });
}

const menu = { keyboard: [[{ text: "📱 Link WhatsApp (QR)" }, { text: "🔍 Start Checking" }]], resize_keyboard: true };

bot.command("start", async (ctx) => {
    await ctx.reply("⚡ 𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐕𝐀𝐋𝐈𝐃𝐀𝐓𝐎𝐑 𝐏𝐑𝐎 ⚡", { reply_markup: menu });
});

bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();
    if (text === "📱 Link WhatsApp (QR)") {
        await ctx.reply("🔄 কিউআর কোড জেনারেট হচ্ছে...");
        connectToWhatsApp(chatId);
    }
});

bot.start();
