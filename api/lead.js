// /api/lead?deal=123 — данные клиента для персонализации.
// { ok, parentName, childName, childAge, mkTime, mkAddress }
// Имя/возраст ребёнка обычно на КОНТАКТЕ, время/адрес МК — на сделке.

module.exports = async function handler(req, res) {
  const allowOrigin = process.env.ALLOWED_ORIGIN;
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  const SUB = process.env.AMO_SUBDOMAIN;
  const TOKEN = process.env.AMO_TOKEN;
  if (!SUB || !TOKEN) return res.status(200).json({ ok: false, error: 'server_not_configured' });

  const deal = String((req.query && req.query.deal) || '').replace(/\D/g, '');
  if (!deal) return res.status(400).json({ ok: false, error: 'bad_deal' });

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}` };

  // по умолчанию — реальные названия полей этого аккаунта (можно переопределить в env)
  const childKey = process.env.AMO_FIELD_CHILD || 'Имя/Имена ребенка';
  const ageKey = process.env.AMO_FIELD_CHILD_AGE || 'Возраст ребенка';
  const mkKey = process.env.AMO_FIELD_MK || '';
  const addrKey = process.env.AMO_FIELD_MK_ADDR || '';
  const doneKey = process.env.AMO_FIELD_DONE_DIAGNOSTIC || 'Прошёл диагностику';
  const fortunaKey = process.env.AMO_FIELD_DONE_FORTUNA || 'Покрутил колесо';
  const TZ = process.env.AMO_TIMEZONE || 'Asia/Almaty'; // Астана UTC+5

  function readField(cfs, key) {
    if (!key) return '';
    const f = (cfs || []).find(c =>
      String(c.field_id) === String(key) ||
      String(c.field_name || '').toLowerCase() === String(key).toLowerCase()
    );
    if (!f || !Array.isArray(f.values) || !f.values.length) return '';
    let v = f.values[0].value;
    // дата/время приходит unix-таймстампом — форматируем в таймзоне Астаны
    if (typeof v === 'number' || /^\d{9,}$/.test(String(v))) {
      const d = new Date(Number(v) * 1000);
      if (!isNaN(d)) {
        try {
          return d.toLocaleString('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return String(v); }
      }
    }
    return String(v == null ? '' : v);
  }

  try {
    const lr = await fetch(`${base}/leads/${deal}?with=contacts`, { headers });
    if (lr.status === 401 || lr.status === 403) return res.status(200).json({ ok: false, error: 'amo_auth' });
    if (lr.status === 404) return res.status(404).json({ ok: false, error: 'deal_not_found' });
    if (!lr.ok) return res.status(200).json({ ok: false, error: 'lead_' + lr.status });
    const lead = await lr.json();
    const leadCfs = lead.custom_fields_values || [];

    // МК — из полей СДЕЛКИ
    const mkTime = readField(leadCfs, mkKey);
    const mkAddress = readField(leadCfs, addrKey);

    // контакт: имя родителя + поля ребёнка
    let parentName = '', contactCfs = [];
    const contacts = (lead._embedded && lead._embedded.contacts) || [];
    const main = contacts.find(c => c.is_main) || contacts[0];
    if (main && main.id) {
      try {
        const cr = await fetch(`${base}/contacts/${main.id}`, { headers });
        if (cr.ok) {
          const c = await cr.json();
          parentName = c.first_name || c.name || '';
          contactCfs = c.custom_fields_values || [];
        }
      } catch (e) { /* контакт не получили — не страшно */ }
    }

    // ребёнок: сначала с контакта, если нет — со сделки
    const childName = readField(contactCfs, childKey) || readField(leadCfs, childKey);
    const childAge = readField(contactCfs, ageKey) || readField(leadCfs, ageKey);

    // уже выполнял? флаги на сделке блокируют повтор (диагностика / колесо)
    const isYes = (v) => v === true || String(v).toLowerCase() === 'true' || v === '1';
    const diagnosticDone = isYes(readField(leadCfs, doneKey));
    const fortunaDone = isYes(readField(leadCfs, fortunaKey));

    return res.status(200).json({ ok: true, parentName, childName, childAge, mkTime, mkAddress, diagnosticDone, fortunaDone });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network' });
  }
};
