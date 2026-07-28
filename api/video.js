// /api/video — доступ к видео по номеру сделки.
// POST { deal } → { ok, parentName, childName, mkTime, expiry, locked }
// expiry — unix-время (сек), до которого видео доступно. При первом входе ставит now + 24ч
// в поле «Видео доступно до» (одно на сделку, хранится в amoCRM → таймер не сбросить перезаходом).

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

  const childKey = process.env.AMO_FIELD_CHILD || '';
  const mkKey = process.env.AMO_FIELD_MK || '';
  const expiryName = process.env.AMO_FIELD_VIDEO_EXPIRY || 'Видео доступно до';

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
  function readNamed(cfs, key) {
    const k = String(key || '').trim();
    if (!k) return '';
    const f = (cfs || []).find(c =>
      String(c.field_id) === k || String(c.field_name || '').toLowerCase() === k.toLowerCase());
    if (!f || !f.values || !f.values.length) return '';
    let v = f.values[0].value;
    if (typeof v === 'number' || /^\d{9,}$/.test(String(v))) {
      const d = new Date(Number(v) * 1000);
      if (!isNaN(d)) { try { return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) {} }
    }
    return String(v == null ? '' : v);
  }

  try {
    const lr = await fetch(`${base}/leads/${deal}?with=contacts`, { headers });
    if (lr.status === 401 || lr.status === 403) return res.status(200).json({ ok: false, error: 'amo_auth' });
    if (lr.status === 404) return res.status(404).json({ ok: false, error: 'deal_not_found' });
    if (!lr.ok) return res.status(200).json({ ok: false, error: 'lead_' + lr.status });
    const lead = await lr.json();
    const cfs = lead.custom_fields_values || [];

    const childName = readNamed(cfs, childKey);
    const mkTime = readNamed(cfs, mkKey);

    let parentName = '';
    const contacts = (lead._embedded && lead._embedded.contacts) || [];
    const main = contacts.find(c => c.is_main) || contacts[0];
    if (main && main.id) {
      try {
        const cr = await fetch(`${base}/contacts/${main.id}`, { headers });
        if (cr.ok) { const c = await cr.json(); parentName = c.first_name || c.name || ''; }
      } catch (e) {}
    }

    // окно доступа 24ч
    let expiry = null, locked = false;
    const expId = await resolveFieldId(expiryName);
    if (expId) {
      const now = Math.floor(Date.now() / 1000);
      const cur = Number(rawById(cfs, expId)) || 0;
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
    }

    return res.status(200).json({ ok: true, parentName, childName, mkTime, expiry, locked });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network' });
  }
};
