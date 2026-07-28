// /api/debug?deal=123 — ВРЕМЕННЫЙ диагностический эндпоинт.
// Показывает реальные кастомные поля сделки и её контакта (id, name, value),
// чтобы найти точные названия полей «имя ребёнка» и «возраст».
// Удалить после настройки. Токен наружу не отдаётся.

module.exports = async function handler(req, res) {
  const SUB = process.env.AMO_SUBDOMAIN;
  const TOKEN = process.env.AMO_TOKEN;
  if (!SUB || !TOKEN) return res.status(500).json({ ok: false, error: 'server_not_configured' });

  const deal = String((req.query && req.query.deal) || '').replace(/\D/g, '');
  if (!deal) return res.status(400).json({ ok: false, error: 'bad_deal' });

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  const dump = (cfs) => (cfs || []).map(f => ({
    id: f.field_id, name: f.field_name,
    value: (f.values && f.values[0]) ? f.values[0].value : null
  }));

  try {
    const lr = await fetch(`${base}/leads/${deal}?with=contacts`, { headers });
    if (!lr.ok) return res.status(200).json({ ok: false, error: 'lead_' + lr.status });
    const lead = await lr.json();
    const out = { ok: true, deal, leadName: lead.name, leadFields: dump(lead.custom_fields_values), contactFields: [] };

    const contacts = (lead._embedded && lead._embedded.contacts) || [];
    const main = contacts.find(c => c.is_main) || contacts[0];
    if (main && main.id) {
      const cr = await fetch(`${base}/contacts/${main.id}`, { headers });
      if (cr.ok) {
        const c = await cr.json();
        out.contactName = c.name;
        out.contactFields = dump(c.custom_fields_values);
      }
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network', detail: String(e).slice(0, 150) });
  }
};
