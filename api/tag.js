// Серверная функция Vercel: ставит тег на сделку в amoCRM.
// Токен и поддомен берутся ТОЛЬКО из переменных окружения (секретов Vercel),
// в код и на страницу они не попадают.
//
// Требуемые переменные окружения (Vercel → Settings → Environment Variables):
//   AMO_SUBDOMAIN  — поддомен amoCRM без ".amocrm.ru", например: kursor
//   AMO_TOKEN      — долгоживущий токен amoCRM (Bearer)
//   AMO_TAG        — (необязательно) какой тег ставить. По умолчанию «Крутил колесо фортуны»
//   ALLOWED_ORIGIN — (необязательно) домен фронта, если он на ДРУГОМ адресе (для CORS)

module.exports = async function handler(req, res) {
  // --- CORS (нужен только если страница на другом домене) ---
  const allowOrigin = process.env.ALLOWED_ORIGIN;
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const SUB   = process.env.AMO_SUBDOMAIN;
  const TOKEN = process.env.AMO_TOKEN;
  const TAG   = process.env.AMO_TAG || 'Крутил колесо фортуны';
  if (!SUB || !TOKEN) return res.status(500).json({ ok: false, error: 'server_not_configured' });

  // --- разбираем и валидируем номер сделки ---
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const rawId = body && (body.dealId != null ? body.dealId : (body.deal_id != null ? body.deal_id : body.id));
  const dealId = String(rawId == null ? '' : rawId).replace(/\D/g, ''); // только цифры → защита от подстановок в URL
  if (!dealId) return res.status(400).json({ ok: false, error: 'bad_deal_id' });

  const base = `https://${SUB}.amocrm.ru/api/v4`;
  const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  try {
    // 1) читаем текущие теги сделки, чтобы не затереть их при обновлении
    const getRes = await fetch(`${base}/leads/${dealId}`, { headers });
    if (getRes.status === 401 || getRes.status === 403) return res.status(502).json({ ok: false, error: 'amo_auth' });
    if (getRes.status === 404) return res.status(404).json({ ok: false, error: 'deal_not_found' });
    if (!getRes.ok) return res.status(502).json({ ok: false, error: 'amo_get_failed' });

    const lead = await getRes.json();
    const existing = (lead && lead._embedded && Array.isArray(lead._embedded.tags)) ? lead._embedded.tags : [];

    // тег уже стоит — считаем успехом (идемпотентно)
    const already = existing.some(t => (t.name || '').toLowerCase() === TAG.toLowerCase());
    if (!already) {
      // amoCRM при PATCH заменяет список тегов целиком → передаём существующие (по id) + новый (по name)
      const tags = existing.map(t => ({ id: t.id })).concat([{ name: TAG }]);
      const patchRes = await fetch(`${base}/leads/${dealId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ _embedded: { tags } })
      });
      if (!patchRes.ok) return res.status(502).json({ ok: false, error: 'amo_patch_failed' });
    }

    return res.status(200).json({ ok: true, dealId, tag: TAG });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'network' });
  }
};
