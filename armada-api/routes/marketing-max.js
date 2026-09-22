import { fetchMainStateRecord, patchStateRecord, pbConfigured } from '../pb.js';

const MAX_API = 'https://platform-api2.max.ru';

function marketingMaxFromPayload(payload) {
  const mm = payload?.marketingMax;
  if (!mm || typeof mm !== 'object') return null;
  const bot = mm.bot && typeof mm.bot === 'object' ? mm.bot : {};
  return {
    bot: {
      token: String(bot.token || ''),
      chatId: String(bot.chatId || ''),
      enabled: !!bot.enabled,
    },
    queue: Array.isArray(mm.queue) ? mm.queue : [],
  };
}

function wrapMaxFetchError(e) {
  const code = e?.cause?.code || '';
  const msg = String(e?.message || e);
  if (msg === 'fetch failed' && /CERT|UNABLE_TO_GET_ISSUER|SELF_SIGNED/.test(String(code))) {
    return new Error(
      'TLS к platform-api2.max.ru: добавьте сертификат Минцифры (NODE_EXTRA_CA_CERTS). См. MAX_PODKLUCHENIE.md',
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

async function maxPostMessage(token, chatId, text) {
  const url = `${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: String(token),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ text: String(text || '').slice(0, 4000) }),
    });
  } catch (e) {
    throw wrapMaxFetchError(e);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(String(err));
  }
  const mid = data?.message_id ?? data?.messageId ?? data?.message?.body?.mid;
  return mid != null ? String(mid) : '';
}

async function loadMarketingState() {
  if (!pbConfigured()) throw new Error('pb_not_configured');
  const rec = await fetchMainStateRecord();
  if (!rec?.id) throw new Error('no_record');
  const payload = rec.payload || {};
  const mm = marketingMaxFromPayload(payload);
  if (!mm) throw new Error('marketingMax не настроен');
  return { rec, payload, mm };
}

async function saveMarketingState(rec, payload) {
  await patchStateRecord(rec.id, { key: 'main', payload });
}

export async function postMarketingMaxTestHandler(req, reply) {
  try {
    const { mm } = await loadMarketingState();
    const { token, chatId } = mm.bot;
    if (!token || !chatId) return reply.code(400).send({ ok: false, error: 'token и chat_id обязательны' });
    const text = 'АРМАДА — тест связи с каналом MAX. Учёт перевозок: https://app.armada.sx/a/';
    const messageId = await maxPostMessage(token, chatId, text);
    return { ok: true, messageId };
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false, error: String(e.message || e) });
  }
}

export async function postMarketingMaxPublishHandler(req, reply) {
  try {
    const postId = req.body?.postId;
    if (!postId) return reply.code(400).send({ ok: false, error: 'postId обязателен' });
    const { rec, payload, mm } = await loadMarketingState();
    const item = mm.queue.find(q => q && q.id === postId);
    if (!item) return reply.code(404).send({ ok: false, error: 'Пост не найден' });
    if (item.status === 'published') return { ok: true, already: true };
    if (item.status === 'cancelled') return reply.code(400).send({ ok: false, error: 'Пост отменён' });
    const { token, chatId } = mm.bot;
    if (!token || !chatId) return reply.code(400).send({ ok: false, error: 'token и chat_id обязательны' });
    try {
      const messageId = await maxPostMessage(token, chatId, item.text);
      item.status = 'published';
      item.publishedAt = new Date().toISOString();
      item.maxMessageId = messageId;
      item.error = '';
      payload.marketingMax.queue = mm.queue;
      await saveMarketingState(rec, payload);
      return { ok: true, messageId, postId };
    } catch (e) {
      item.status = 'failed';
      item.error = String(e.message || e);
      payload.marketingMax.queue = mm.queue;
      await saveMarketingState(rec, payload);
      return reply.code(500).send({ ok: false, error: item.error });
    }
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false, error: String(e.message || e) });
  }
}

export async function postMarketingMaxTickHandler(req, reply) {
  try {
    const { rec, payload, mm } = await loadMarketingState();
    if (!mm.bot.enabled) return { ok: true, published: 0, skipped: 'disabled' };
    const { token, chatId } = mm.bot;
    if (!token || !chatId) return reply.code(400).send({ ok: false, error: 'token и chat_id обязательны' });
    const now = Date.now();
    let published = 0;
    let failed = 0;
    for (const item of mm.queue) {
      if (!item || item.status !== 'scheduled' || !item.scheduledAt) continue;
      const t = new Date(item.scheduledAt).getTime();
      if (Number.isNaN(t) || t > now) continue;
      try {
        const messageId = await maxPostMessage(token, chatId, item.text);
        item.status = 'published';
        item.publishedAt = new Date().toISOString();
        item.maxMessageId = messageId;
        item.error = '';
        published++;
      } catch (e) {
        item.status = 'failed';
        item.error = String(e.message || e);
        failed++;
      }
    }
    if (published || failed) {
      payload.marketingMax.queue = mm.queue;
      await saveMarketingState(rec, payload);
    }
    return { ok: true, published, failed };
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false, error: String(e.message || e) });
  }
}
