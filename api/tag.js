// Серверная функция Vercel: ставит тег на сделку в amoCRM.
// Токен и поддомен — ТОЛЬКО из переменных окружения (секретов Vercel).
//
// Тело запроса (JSON): { "deal": "123456", "event": "video" | "fortuna" | "diagnostic" }
//
// Переменные окружения:
//   AMO_SUBDOMAIN  — поддомен без ".amocrm.ru" (например: kursor)
//   AMO_TOKEN      — долгоживущий токен amoCRM
//   (необязательно, переопределяют тексты тегов)
//   AMO_TAG_VIDEO      = Посмотрел видео-презентацию Нурмаш
//   AMO_TAG_FORTUNA    = Покрутил колесо Фортуны
//   AMO_TAG_DIAGNOSTIC = Прошёл диагностику
//   ALLOWED_ORIGIN — если фронт на другом домене (обычно не нужно)

module.exports = async function handler(req, res) {
  const allowOrigin = process.env.ALLOWED_ORIGIN;
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const SUB = process.env.AMO_SUBDOMAIN;
  const TOKEN = process.env.AMO_TOKEN;
  if (!SUB || !TOKEN) return res.status(500).json({ ok: false, error: 'server_not_configured' });

  // допустимые события → тексты тегов (произвольные теги от клиента не принимаем)
  const TAGS = {
    video:      process.env.AMO_TAG_VIDEO      || 'Посмотрел видео-презентацию Нурмаш',
    fortuna:    process.env.AMO_TAG_FORTUNA    || 'Покрутил колесо Фортуны',
    diagnostic: process.env.AMO_TAG_DIAGNOSTIC || 'Прошёл диагностику'
  };

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const deal = String((body && (body.deal != null ? body.deal : body.dealId)) || '').replace(/\D/g, '');
  const event = String((body && body.event) || '').toLowerCase();
  const TAG = TAGS[event];
  if (!deal) return res.status(400).json({ ok: false, error: 'bad_deal' });
  if (!TAG)  return res.status(400).json({ ok: false, error: 'bad_event' });

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  try {
    // читаем текущие теги, чтобы не затереть
    const getRes = await fetch(`${base}/leads/${deal}`, { headers });
    if (getRes.status === 401 || getRes.status === 403) return res.status(502).json({ ok: false, error: 'amo_auth' });
    if (getRes.status === 404) return res.status(404).json({ ok: false, error: 'deal_not_found' });
    if (!getRes.ok) return res.status(502).json({ ok: false, error: 'amo_get_failed' });

    const lead = await getRes.json();
    const existing = (lead && lead._embedded && Array.isArray(lead._embedded.tags)) ? lead._embedded.tags : [];
    const already = existing.some(t => (t.name || '').toLowerCase() === TAG.toLowerCase());

    if (!already) {
      const tags = existing.map(t => ({ id: t.id })).concat([{ name: TAG }]);
      const patchRes = await fetch(`${base}/leads/${deal}`, {
        method: 'PATCH', headers, body: JSON.stringify({ _embedded: { tags } })
      });
      if (!patchRes.ok) return res.status(502).json({ ok: false, error: 'amo_patch_failed' });
    }
    return res.status(200).json({ ok: true, deal, tag: TAG });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'network' });
  }
};
