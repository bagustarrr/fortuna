// Серверная функция Vercel: отмечает целевое действие на сделке в amoCRM.
// После действия: (1) ставит да/нет поле «Покрутил/Посмотрел/Прошёл» = ДА (чекбокс),
//                 (2) вешает тег (для наглядности; можно игнорировать).
//
// Тело запроса (JSON): { "deal": "123456", "event": "video" | "fortuna" | "diagnostic" }
//
// Переменные окружения:
//   AMO_SUBDOMAIN, AMO_TOKEN — доступ к amoCRM
//   AMO_FIELD_DONE_VIDEO      — ID поля-флага «Посмотрел видео»
//   AMO_FIELD_DONE_FORTUNA    — ID поля-флага «Покрутил колесо»
//   AMO_FIELD_DONE_DIAGNOSTIC — ID поля-флага «Прошёл диагностику»
//   (необязательно) AMO_TAG_VIDEO / AMO_TAG_FORTUNA / AMO_TAG_DIAGNOSTIC — тексты тегов
//   (необязательно) ALLOWED_ORIGIN

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

  const TAGS = {
    video:      process.env.AMO_TAG_VIDEO      || 'Посмотрел видео-презентацию Нурмаш',
    fortuna:    process.env.AMO_TAG_FORTUNA    || 'Покрутил колесо Фортуны',
    diagnostic: process.env.AMO_TAG_DIAGNOSTIC || 'Прошёл диагностику'
  };
  const DONE_FIELDS = {
    video:      process.env.AMO_FIELD_DONE_VIDEO,
    fortuna:    process.env.AMO_FIELD_DONE_FORTUNA,
    diagnostic: process.env.AMO_FIELD_DONE_DIAGNOSTIC
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

  // поле можно задать числовым ID или НАЗВАНИЕ (тогда найдём ID в списке полей сделок)
  async function resolveFieldId(key) {
    const k = String(key || '').trim();
    if (!k) return null;
    if (/^\d+$/.test(k)) return Number(k);
    try {
      const r = await fetch(`${base}/leads/custom_fields?limit=250`, { headers });
      if (!r.ok) return null;
      const d = await r.json();
      const fields = (d && d._embedded && d._embedded.custom_fields) || [];
      const f = fields.find(x => String(x.name || '').toLowerCase() === k.toLowerCase());
      return f ? f.id : null;
    } catch (e) { return null; }
  }

  try {
    // текущие теги, чтобы не затереть
    const getRes = await fetch(`${base}/leads/${deal}`, { headers });
    if (getRes.status === 401 || getRes.status === 403) return res.status(502).json({ ok: false, error: 'amo_auth' });
    if (getRes.status === 404) return res.status(404).json({ ok: false, error: 'deal_not_found' });
    if (!getRes.ok) return res.status(502).json({ ok: false, error: 'amo_get_failed' });

    const lead = await getRes.json();
    const existing = (lead && lead._embedded && Array.isArray(lead._embedded.tags)) ? lead._embedded.tags : [];
    const already = existing.some(t => (t.name || '').toLowerCase() === TAG.toLowerCase());

    const patch = {};
    if (!already) {
      patch._embedded = { tags: existing.map(t => ({ id: t.id })).concat([{ name: TAG }]) };
    }
    const doneFieldId = await resolveFieldId(DONE_FIELDS[event]);
    if (doneFieldId) {
      patch.custom_fields_values = [{ field_id: doneFieldId, values: [{ value: true }] }];
    }

    if (patch._embedded || patch.custom_fields_values) {
      const patchRes = await fetch(`${base}/leads/${deal}`, {
        method: 'PATCH', headers, body: JSON.stringify(patch)
      });
      if (!patchRes.ok) return res.status(502).json({ ok: false, error: 'amo_patch_failed' });
    }
    return res.status(200).json({ ok: true, deal, tag: TAG, field: doneFieldId || null });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'network' });
  }
};
