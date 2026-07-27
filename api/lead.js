// Серверная функция Vercel: отдаёт данные клиента по номеру сделки amoCRM.
// Нужна для персонализации страниц (приветствие по имени, имя ребёнка, время МК).
// Токен читается только из окружения; наружу токен НЕ отдаётся.
//
// GET /api/lead?deal=123456  →  { ok, parentName, childName, mkTime }
//
// Переменные окружения:
//   AMO_SUBDOMAIN, AMO_TOKEN — как в /api/tag
//   AMO_FIELD_CHILD — имя ИЛИ id поля сделки с именем ребёнка (например: "Имя ребёнка")
//   AMO_FIELD_MK    — имя ИЛИ id поля сделки со временем мастер-класса (например: "Мастер-класс")
// Если поля не заданы/не найдены — вернём пустые значения, страница покажет общий текст.

module.exports = async function handler(req, res) {
  const allowOrigin = process.env.ALLOWED_ORIGIN;
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  const SUB = process.env.AMO_SUBDOMAIN;
  const TOKEN = process.env.AMO_TOKEN;
  // при отсутствии настроек отвечаем 200/ok:false — страница просто покажет общий текст
  if (!SUB || !TOKEN) return res.status(200).json({ ok: false, error: 'server_not_configured' });

  const deal = String((req.query && req.query.deal) || '').replace(/\D/g, '');
  if (!deal) return res.status(400).json({ ok: false, error: 'bad_deal' });

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}` };

  const childKey = process.env.AMO_FIELD_CHILD || '';
  const mkKey = process.env.AMO_FIELD_MK || '';

  function readField(cfs, key) {
    if (!key) return '';
    const f = (cfs || []).find(c =>
      String(c.field_id) === String(key) ||
      String(c.field_name || '').toLowerCase() === String(key).toLowerCase()
    );
    if (!f || !Array.isArray(f.values) || !f.values.length) return '';
    let v = f.values[0].value;
    // поле-дата приходит unix-таймстампом — форматируем в читаемый вид
    if (typeof v === 'number' || /^\d{9,}$/.test(String(v))) {
      const d = new Date(Number(v) * 1000);
      if (!isNaN(d)) {
        try {
          return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return String(v); }
      }
    }
    return String(v == null ? '' : v);
  }

  try {
    const lr = await fetch(`${base}/leads/${deal}?with=contacts`, { headers });
    if (lr.status === 401 || lr.status === 403) return res.status(200).json({ ok: false, error: 'amo_auth' });
    if (!lr.ok) return res.status(200).json({ ok: false, error: 'lead_' + lr.status });
    const lead = await lr.json();

    const childName = readField(lead.custom_fields_values, childKey);
    const mkTime = readField(lead.custom_fields_values, mkKey);

    // имя родителя — из основного контакта сделки
    let parentName = '';
    const contacts = (lead._embedded && lead._embedded.contacts) || [];
    const main = contacts.find(c => c.is_main) || contacts[0];
    if (main && main.id) {
      try {
        const cr = await fetch(`${base}/contacts/${main.id}`, { headers });
        if (cr.ok) {
          const c = await cr.json();
          parentName = c.first_name || c.name || '';
        }
      } catch (e) { /* контакт не получили — не страшно */ }
    }

    return res.status(200).json({ ok: true, parentName, childName, mkTime });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network' });
  }
};
