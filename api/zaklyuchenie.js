// /api/zaklyuchenie — доступ к персональному заключению по номеру сделки.
// POST { deal } → { ok, childName, childAge, diagnosticDate, expiry, locked }
// expiry — unix-время (сек) конца 24-часового окна. При первом входе ставит now+24ч
// в поле сделки «Заключение доступно до» (хранится в amoCRM → таймер не сбросить перезаходом).
// Имя/возраст ребёнка читаются с КОНТАКТА (как в /api/lead).

const HOURS = 24;

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

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const deal = String((body && (body.deal != null ? body.deal : body.dealId)) || '').replace(/\D/g, '');
  if (!deal) return res.status(400).json({ ok: false, error: 'bad_deal' });

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  // названия полей — те же, что в /api/lead (ребёнок обычно на контакте)
  const childKey = process.env.AMO_FIELD_CHILD || 'Имя/Имена ребенка';
  const ageKey = process.env.AMO_FIELD_CHILD_AGE || 'Возраст ребенка';
  const diagKey = process.env.AMO_FIELD_DIAGNOSTIC_DATE || 'Дата диагностики';
  const expiryName = process.env.AMO_FIELD_ZAK_EXPIRY || 'Заключение доступно до';
  const TZ = process.env.AMO_TIMEZONE || 'Asia/Almaty';

  // читает поле по имени/id; дату (unix) форматирует, возраст/числа отдаёт как есть
  function readField(cfs, key) {
    const k = String(key || '').trim();
    if (!k) return '';
    const f = (cfs || []).find(c =>
      String(c.field_id) === k || String(c.field_name || '').toLowerCase() === k.toLowerCase());
    if (!f || !Array.isArray(f.values) || !f.values.length) return '';
    let v = f.values[0].value;
    // дата приходит unix-таймстампом (>1e9); возраст (12) под это не попадает
    if ((typeof v === 'number' && v > 1e9) || /^\d{9,}$/.test(String(v))) {
      const d = new Date(Number(v) * 1000);
      if (!isNaN(d)) {
        try { return d.toLocaleString('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
      }
    }
    return String(v == null ? '' : v);
  }

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

  try {
    const lr = await fetch(`${base}/leads/${deal}?with=contacts`, { headers });
    if (lr.status === 401 || lr.status === 403) return res.status(200).json({ ok: false, error: 'amo_auth' });
    if (lr.status === 404) return res.status(404).json({ ok: false, error: 'deal_not_found' });
    if (!lr.ok) return res.status(200).json({ ok: false, error: 'lead_' + lr.status });
    const lead = await lr.json();
    const leadCfs = lead.custom_fields_values || [];

    // контакт → поля ребёнка
    let contactCfs = [];
    const contacts = (lead._embedded && lead._embedded.contacts) || [];
    const main = contacts.find(c => c.is_main) || contacts[0];
    if (main && main.id) {
      try {
        const cr = await fetch(`${base}/contacts/${main.id}`, { headers });
        if (cr.ok) { const c = await cr.json(); contactCfs = c.custom_fields_values || []; }
      } catch (e) {}
    }
    const childName = readField(contactCfs, childKey) || readField(leadCfs, childKey);
    const childAge = readField(contactCfs, ageKey) || readField(leadCfs, ageKey);
    const diagnosticDate = readField(leadCfs, diagKey) || readField(contactCfs, diagKey);

    // окно доступа 24ч — поле на сделке
    let expiry = null, locked = false;
    const expId = await resolveFieldId(expiryName);
    if (expId) {
      const now = Math.floor(Date.now() / 1000);
      const cur = Number(rawById(leadCfs, expId)) || 0;
      if (cur > 0) {
        expiry = cur;
        locked = now > cur;
      } else {
        expiry = now + HOURS * 3600;
        try {
          await fetch(`${base}/leads/${deal}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ custom_fields_values: [{ field_id: expId, values: [{ value: expiry }] }] })
          });
        } catch (e) {}
      }
    } else {
      // поля срока нет — доступ без хранимого таймера (скользящие 24ч, не защищено от перезахода)
      expiry = Math.floor(Date.now() / 1000) + HOURS * 3600;
    }

    return res.status(200).json({ ok: true, childName, childAge, diagnosticDate, expiry, locked });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network' });
  }
};
