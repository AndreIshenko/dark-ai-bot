const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 1. Веб-сервер заглушка для Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('DarkAi Bot запущен и работает!');
}).listen(PORT, () => {
  console.log(`Веб-сервер запущен на порту ${PORT}`);
});

if (!BOT_TOKEN) {
  console.error("ОШИБКА: BOT_TOKEN не найден!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const AI_MODEL = "openrouter/auto";

// Защита от падения приложения
process.on('uncaughtException', (err) => {
  console.error('Перехвачена необработанная ошибка:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Перехвачен отклонённый Промис:', reason);
});

bot.catch((err, ctx) => {
  console.error(`Ошибка Telegraf для ${ctx.updateType}:`, err);
});

const helpMessage = 
  "✨ **Главное меню DarkAi** ✨\n\n" +
  "🤖 **Текст:** Пишите любые вопросы на русском или украинском.\n" +
  "🎨 **Картинки (Flux HD):** Команда `/img <описание>` ИЛИ *«нарисуй...»* / *«намалюй...»*.\n" +
  "ℹ️ **Информация:** Узнать возможности бота.";

const mainMenu = Markup.keyboard([
  ['🎨 Сгенерировать картинку', 'ℹ️ О боте'],
  ['📜 Справка']
]).resize();

bot.start(async (ctx) => {
  await ctx.reply(
    `Привет! 👋 Я **DarkAi** — твой персональный ИИ-помощник.\n\n${helpMessage}`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('ℹ️ О боте', async (ctx) => {
  await ctx.reply(
    "🤖 **DarkAi Bot**\n\n" +
    "• **Языки:** Русский, Українська 🇷🇺🇺🇦\n" +
    "• **Текстовый ИИ:** OpenRouter Auto\n" +
    "• **Генерация фото:** Pollinations (Модель: Flux, без водяных знаков) 🎨",
    { parse_mode: 'Markdown' }
  );
});

bot.hears('📜 Справка', async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('🎨 Сгенерировать картинку', async (ctx) => {
  await ctx.reply("Чтобы сгенерировать картинку, напишите:\n`/img кабан в лісі`\nИли просто:\n*«Нарисуй кота»* / *«Намалюй вовка»*", { parse_mode: 'Markdown' });
});

// Генерация через модель FLUX без водяных знаков
async function generateAndSendImage(ctx, userPrompt) {
  const statusMsg = await ctx.reply("🎨 **Создаю промпт и запускаю Flux...**\n⏳ *Подождите пару секунд...*", { parse_mode: 'Markdown' });

  try {
    const apiKey = OPENROUTER_API_KEY ? OPENROUTER_API_KEY.trim() : '';
    
    // Перевод и оптимизация под Flux
    const translationResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://t.me/DarkAiBot",
        "X-Title": "DarkAi Bot"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { 
            role: "system", 
            content: "You are an expert prompt engineer for the FLUX image generator. Translate the user description from Russian or Ukrainian into a detailed, high-quality English prompt. Make it descriptive, beautiful, and cinematic. Output ONLY the final English prompt, nothing else." 
          },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const translationData = await translationResponse.json();
    let finalPrompt = translationData.choices?.[0]?.message?.content || userPrompt;
    finalPrompt = finalPrompt.replace(/^["']|["']$/g, '').trim();

    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      "🎨 **Генерирую в высоком качестве (Flux)...**\n⏳ *Еще секундочку...*", 
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    const encodedPrompt = encodeURIComponent(finalPrompt);
    const randomSeed = Math.floor(Math.random() * 10000000);
    
    // ДОБАВЛЕНО: model=flux и nologo=true (убирает водяной знак)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&seed=${randomSeed}`;
    
    await ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    await ctx.replyWithPhoto(imageUrl, { 
      caption: `✨ **Запрос:** _"${userPrompt}"_\n\n⚙️ **Flux Промпт:** \`${finalPrompt}\``,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error("Ошибка при генерации картинки:", error);
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      "❌ Не удалось сгенерировать картинку. Попробуйте другой запрос."
    );
  }
}

bot.command('img', async (ctx) => {
  const text = ctx.message.text;
  const prompt = text.replace('/img', '').trim();
  
  if (!prompt) {
    return ctx.reply("⚠️ Укажите описание! Пример:\n`/img кабан в лісі`", { parse_mode: 'Markdown' });
  }

  await generateAndSendImage(ctx, prompt);
});

bot.on('text', async (ctx) => {
  const userText = ctx.message.text;
  
  if (['🎨 Сгенерировать картинку', 'ℹ️ О боте', '📜 Справка'].includes(userText)) return;

  const lowerText = userText.toLowerCase();
  
  const drawKeywords = [
    'нарисуй', 'сгенерируй', 'создай фото', 'создай картинку', 'нарисуй картинку', 'сделай картинку',
    'намалюй', 'згенеруй', 'створи фото', 'створи картинку', 'зроби картинку'
  ];
  
  const isDrawRequest = drawKeywords.some(keyword => lowerText.startsWith(keyword));

  if (isDrawRequest) {
    let cleanPrompt = userText;
    drawKeywords.forEach(keyword => {
      const reg = new RegExp(`^${keyword}`, 'i');
      cleanPrompt = cleanPrompt.replace(reg, '').trim();
    });

    if (!cleanPrompt) {
      return ctx.reply("⚠️ Напишите, что именно нарисовать! Например:\n*Нарисуй замок в горах*", { parse_mode: 'Markdown' });
    }

    return await generateAndSendImage(ctx, cleanPrompt);
  }

  await ctx.sendChatAction('typing');
  const statusMsg = await ctx.reply("🧠 *Думаю над ответом...*", { parse_mode: 'Markdown' });

  try {
    const apiKey = OPENROUTER_API_KEY ? OPENROUTER_API_KEY.trim() : '';
    const currentDate = new Date().toLocaleDateString('ru-RU', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://t.me/DarkAiBot",
        "X-Title": "DarkAi Bot"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { 
            role: "system", 
            content: `Ты вежливый, дружелюбный и умный ИИ-помощник DarkAi. Всегда отвечай на том же языке, на котором пишет пользователь (русский или украинский). Сегодняшняя дата: ${currentDate}.` 
          },
          { role: "user", content: userText }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Ошибка API");
    }

    const replyText = data.choices?.[0]?.message?.content || "❌ Не удалось получить ответ от ИИ.";

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      replyText,
      { parse_mode: 'Markdown' }
    ).catch(async () => {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, replyText);
    });

  } catch (error) {
    console.error("Ошибка ИИ:", error);
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      statusMsg.message_id, 
      null, 
      `❌ Ошибка связи с ИИ: ${error.message}`
    );
  }
});

bot.launch().then(() => {
  console.log("Бот DarkAi запущен на модели Flux без водяных знаков!");
}).catch((err) => {
  console.error("Ошибка при запуске бота:", err);
});
