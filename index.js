const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 1. Заглушка для Render, чтобы сервис не выключался по таймауту порта
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('DarkAi Bot работает!');
}).listen(PORT, () => {
  console.log(`Веб-сервер запущен на порту ${PORT}`);
});

// 2. Инициализация Telegram-бота
const bot = new Telegraf(BOT_TOKEN);
const AI_MODEL = "google/gemini-2.0-flash-exp:free";

const helpMessage = 
  "✨ **Главное меню DarkAi** ✨\n\n" +
  "🤖 **Текст:** Просто отправьте мне любой вопрос или задачу.\n" +
  "🎨 **Картинки:** Нажмите кнопку ниже или напишите `/img <описание>`\n" +
  "ℹ️ **Информация:** Узнать возможности бота.";

const mainMenu = Markup.keyboard([
  ['🎨 Сгенерировать картинку', 'ℹ️ О боте'],
  ['📜 Справка']
]).resize();

bot.start(async (ctx) => {
  await ctx.reply(
    `Привет, ${ctx.from.first_name || 'друг'}! 👋\n\nЯ **DarkAi** — твой персональный ИИ-помощник.\n\n${helpMessage}`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('ℹ️ О боте', async (ctx) => {
  await ctx.reply(
    "🤖 **DarkAi Bot**\n\n" +
    "• **Текстовый ИИ:** Gemini 2.0 Flash (быстрые и свежие ответы)\n" +
    "• **Генерация фото:** Pollinations AI\n" +
    "• **Скорость:** Высокая ⚡️",
    { parse_mode: 'Markdown' }
  );
});

bot.hears('📜 Справка', async (ctx) => {
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.hears('🎨 Сгенерировать картинку', async (ctx) => {
  await ctx.reply("Чтобы сгенерировать картинку, напишите команду в формате:\n\n`/img неоновый город будущего`", { parse_mode: 'Markdown' });
});

// Генерация изображений
bot.command('img', async (ctx) => {
  const text = ctx.message.text;
  const prompt = text.replace('/img', '').trim();
  
  if (!prompt) {
    return ctx.reply("⚠️ Пожалуйста, укажите описание! Пример:\n`/img киберпанк кот в очках`", { parse_mode: 'Markdown' });
  }

  const statusMsg = await ctx.reply("🎨 **Генерирую изображение...**\n⏳ *Подождите несколько секунд...*", { parse_mode: 'Markdown' });

  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    
    await ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    await ctx.replyWithPhoto(imageUrl, { 
      caption: `✨ **Результат по запросу:**\n_"${prompt}"_`,
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
});

// Текстовый диалог с ИИ (Gemini 2.0 Flash)
bot.on('text', async (ctx) => {
  const userText = ctx.message.text;
  
  if (['🎨 Сгенерировать картинку', 'ℹ️ О боте', '📜 Справка'].includes(userText)) return;

  await ctx.sendChatAction('typing');
  const statusMsg = await ctx.reply("🧠 *Думаю над ответом...*", { parse_mode: 'Markdown' });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://telegram.org",
        "X-Title": "DarkAi Bot"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { 
            role: "system", 
            content: "Ты вежливый, умный и современный ИИ-помощник DarkAi. Отвечай качественно, с хорошим форматированием и эмодзи." 
          },
          { role: "user", content: userText }
        ]
      })
    });

    const data = await response.json();
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
      "❌ Произошла ошибка при связи с ИИ. Попробуйте позже."
    );
  }
});

bot.launch();
console.log("Бот и веб-сервер успешно запущены!");
