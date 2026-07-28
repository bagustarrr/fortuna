// /api/setup — одноразовое (идемпотентное) создание нужных полей сделки в amoCRM.
// Открыть в браузере ОДИН раз: https://ВАШ-домен.vercel.app/api/setup
// (если задан SETUP_KEY — то /api/setup?key=ВАШ_КЛЮЧ)
// Повторный вызов безопасен: создаёт только недостающие поля.
//
// Использует AMO_SUBDOMAIN и AMO_TOKEN из переменных Vercel. Токен наружу не отдаётся.

module.exports = async function handler(req, res) {
  const SUB = process.env.AMO_SUBDOMAIN;
  const TOKEN = process.env.AMO_TOKEN;
  if (!SUB || !TOKEN) return res.status(500).json({ ok: false, error: 'server_not_configured' });

  const KEY = process.env.SETUP_KEY;
  if (KEY && String((req.query && req.query.key) || '') !== KEY) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  // Нужные поля сделки (тип amoCRM v4):
  const WANT = [
    { name: 'Посмотрел видео',      type: 'checkbox'  },
    { name: 'Покрутил колесо',      type: 'checkbox'  },
    { name: 'Прошёл диагностику',   type: 'checkbox'  },
    { name: 'Просмотрено видео, %', type: 'numeric'   },
    { name: 'Видео доступно до',    type: 'date_time' }
  ];

  try {
    // читаем существующие поля (несколько страниц)
    let existing = [];
    for (let page = 1; page <= 6; page++) {
      const r = await fetch(`${base}/leads/custom_fields?limit=250&page=${page}`, { headers });
      if (r.status === 401 || r.status === 403) return res.status(502).json({ ok: false, error: 'amo_auth' });
      if (!r.ok) break;
      const d = await r.json();
      const fs = (d._embedded && d._embedded.custom_fields) || [];
      existing = existing.concat(fs);
      if (fs.length < 250) break;
    }
    const have = new Map(existing.map(f => [String(f.name || '').toLowerCase(), f]));
    const toCreate = WANT.filter(w => !have.has(w.name.toLowerCase()));

    let created = [];
    if (toCreate.length) {
      const r = await fetch(`${base}/leads/custom_fields`, {
        method: 'POST', headers, body: JSON.stringify(toCreate)
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        return res.status(502).json({ ok: false, error: 'create_failed', status: r.status, detail: t.slice(0, 400) });
      }
      const d = await r.json();
      created = ((d._embedded && d._embedded.custom_fields) || []);
      created.forEach(f => have.set(String(f.name || '').toLowerCase(), f));
    }

    const fields = WANT.map(w => {
      const f = have.get(w.name.toLowerCase());
      return { name: w.name, id: f ? f.id : null, type: w.type };
    });
    return res.status(200).json({
      ok: true,
      message: created.length ? ('Создано полей: ' + created.length) : 'Все поля уже существуют',
      created: created.map(f => f.name),
      fields
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'network', detail: String(e).slice(0, 200) });
  }
};
