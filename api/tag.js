// /api/tag — отмечает целевое действие на сделке в amoCRM.
// POST { deal, event, percent? }
//   event: "video" | "fortuna" | "diagnostic"
//   percent (только для video): текущий % просмотра → пишем максимум в поле «Просмотрено видео, %».
// Когда действие выполнено (для video: percent >= порога; для остальных: любой вызов):
//   ставит поле-флаг «Посмотрел видео / Покрутил колесо / Прошёл диагностику» = ДА и вешает тег.
//
// Названия полей по умолчанию совпадают с /api/setup — доп. настройка env не нужна.
// Переопределить можно: AMO_FIELD_DONE_VIDEO/FORTUNA/DIAGNOSTIC, AMO_FIELD_VIDEO_PCT, AMO_VIDEO_THRESHOLD.

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
    video:      process.env.AMO_FIELD_DONE_VIDEO      || 'Посмотрел видео',
    fortuna:    process.env.AMO_FIELD_DONE_FORTUNA    || 'Покрутил колесо',
    diagnostic: process.env.AMO_FIELD_DONE_DIAGNOSTIC || 'Прошёл диагностику'
  };
  const PCT_FIELD = process.env.AMO_FIELD_VIDEO_PCT || 'Просмотрено видео, %';
  const THRESHOLD = Number(process.env.AMO_VIDEO_THRESHOLD) || 70;

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const deal = String((body && (body.deal != null ? body.deal : body.dealId)) || '').replace(/\D/g, '');
  const event = String((body && body.event) || '').toLowerCase();
  const hasPct = body && body.percent != null && body.percent !== '';
  const percent = hasPct ? Math.max(0, Math.min(100, Math.round(Number(body.percent) || 0))) : null;
  const TAG = TAGS[event];
  if (!deal) return res.status(400).json({ ok: false, error: 'bad_deal' });
  if (!TAG)  return res.status(400).json({ ok: false, error: 'bad_event' });

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  async function resolveFieldId(key) {
    const k = String(key || '').trim();
    if (!k) return null;
    if (/^\d+$/.test(k)) return Number(k);
    try {
      const r = await fetch(`${base}/leads/custom_fields?limit=250`, { headers });
      if (!r.ok) return null;
      const d = await r.json();
      const fields = (d._embedded && d._embedded.custom_fields) || [];
      const f = fields.find(x => String(x.name || '').toLowerCase() === k.toLowerCase());
      return f ? f.id : null;
    } catch (e) { return null; }
  }
  function rawById(cfs, id) {
    const f = (cfs || []).find(c => String(c.field_id) === String(id));
    return (f && f.values && f.values.length) ? f.values[0].value : '';
  }

  // выполнено ли действие: с percent — по порогу; без percent — считаем выполненным (fortuna/diagnostic)
  const isDone = (percent == null) ? true : (percent >= THRESHOLD);

  try {
    const getRes = await fetch(`${base}/leads/${deal}`, { headers });
    if (getRes.status === 401 || getRes.status === 403) return res.status(502).json({ ok: false, error: 'amo_auth' });
    if (getRes.status === 404) return res.status(404).json({ ok: false, error: 'deal_not_found' });
    if (!getRes.ok) return res.status(502).json({ ok: false, error: 'amo_get_failed' });
    const lead = await getRes.json();
    const cfs = lead.custom_fields_values || [];
    const existingTags = (lead._embedded && Array.isArray(lead._embedded.tags)) ? lead._embedded.tags : [];

    const cfv = [];

    // % просмотра (только video, только рост)
    if (percent != null && event === 'video') {
      const pctId = await resolveFieldId(PCT_FIELD);
      if (pctId) {
        const cur = Number(rawById(cfs, pctId)) || 0;
        cfv.push({ field_id: pctId, values: [{ value: Math.max(cur, percent) }] });
      }
    }

    const patch = {};
    if (isDone) {
      const doneId = await resolveFieldId(DONE_FIELDS[event]);
      if (doneId) cfv.push({ field_id: doneId, values: [{ value: true }] });
      const already = existingTags.some(t => (t.name || '').toLowerCase() === TAG.toLowerCase());
      if (!already) patch._embedded = { tags: existingTags.map(t => ({ id: t.id })).concat([{ name: TAG }]) };
    }
    if (cfv.length) patch.custom_fields_values = cfv;

    if (patch._embedded || patch.custom_fields_values) {
      const patchRes = await fetch(`${base}/leads/${deal}`, { method: 'PATCH', headers, body: JSON.stringify(patch) });
      if (!patchRes.ok) return res.status(502).json({ ok: false, error: 'amo_patch_failed' });
    }
    return res.status(200).json({ ok: true, deal, percent, done: isDone });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'network' });
  }
};
