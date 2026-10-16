const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const bot = new Telegraf(BOT_TOKEN);

// Выбираем более современную бесплатную модель (Gemini 2.0 Flash Free)
const AI_MODEL = "google/gemini-2.0-flash-exp:free";

const helpMessage = 
  "✨ **Главное меню DarkAi** ✨\n\n" +
  "🤖 **Текст:** Просто отправьте мне любой вопрос или задачу.\n" +
  "🎨 **Картинки:** Нажмите кнопку ниже или напишите `/img <описание>`\n" +
  "ℹ️ **Информация:** Узнать возможности бота.";

// Главное меню с интерактивными кнопками
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
    "• **Генерация фото:** Pollinations AI (без ограничений)\n" +
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

// Генерация изображений с индикатором загрузки
bot.command('img', async (ctx) => {
  const text = ctx.message.text;
  const prompt = text.replace('/img', '').trim();
  
  if (!prompt) {
    return ctx.reply("⚠️ Пожалуйста, укажите описание! Пример:\n`/img киберпанк кот в очках`", { parse_mode: 'Markdown' });
  }

  // Красивый статус ожидания
  const statusMsg = await ctx.reply("🎨 **Генерирую изображение...**\n⏳ *Подождите несколько секунд...*", { parse_mode: 'Markdown' });

  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    
    // Удаляем статусный текст и отправляем готовое фото
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

// Текстовый диалог с ИИ
bot.on('text', async (ctx) => {
  const userText = ctx.message.text;
  
  // Игнорируем нажатия на встроенные кнопки
  if (['🎨 Сгенерировать картинку', 'ℹ️ О боте', '📜 Справка'].includes(userText)) return;

  // Имитация набора текста в Telegram ("typing...")
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

    // Заменяем сообщение с ожиданием на готовый ответ
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      replyText,
      { parse_mode: 'Markdown' }
    ).catch(async () => {
      // Если форматирование Markdown вызвало ошибку, отправляем чистый текст
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
console.log("Бот запущен!");
