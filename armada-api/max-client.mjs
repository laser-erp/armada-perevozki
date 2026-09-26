/**
 * MAX Bot API — пост в канал (platform-api2.max.ru).
 * Токен и chat_id только из process.env на сервере.
 */
const MAX_API = 'https://platform-api2.max.ru';

export function maxConfig() {
  const token = String(process.env.MAX_BOT_TOKEN || '').trim();
  const chatId = String(process.env.MAX_CHANNEL_CHAT_ID || '').trim();
  return {
    token,
    chatId,
    configured: !!(token && chatId),
  };
}

export function maxHealthPublic() {
  const { configured, chatId } = maxConfig();
  return {
    configured,
    channelChatId: chatId ? `${chatId.slice(0, 2)}…${chatId.slice(-3)}` : null,
  };
}

/**
 * @param {string} text
 * @param {{ format?: 'markdown'|'html' }} [opts]
 */
export async function maxPostToChannel(text, opts = {}) {
  const { token, chatId, configured } = maxConfig();
  if (!configured) {
    const err = new Error('max_not_configured');
    err.code = 'max_not_configured';
    throw err;
  }
  const url = `${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`;
  const body = { text: String(text || '').slice(0, 4000), notify: true };
  if (opts.format) body.format = opts.format;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `MAX HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}
