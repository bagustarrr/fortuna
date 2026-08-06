(function () {
  'use strict';

  // Билет собирается на форме перед показом:
  //   — Имя ученика и дату мастер-класса можно вбить вручную;
  //   — либо они подтягиваются из сделки по ссылке ?deal= (UTM) через kursor.js:
  //       KX.child — имя ребёнка, KX.mk — дата/время МК, KX.deal — номер сделки.
  //   — Тренер по умолчанию «Темерлан»; адрес всегда «ул. Жумабека Ташенова, 8».

  const params = new URLSearchParams(window.location.search);
  const $ = (s) => document.querySelector(s);

  const setup = $('#setup');
  const ticketView = $('#ticketView');
  const fName = $('#f-name');
  const fDate = $('#f-date');
  const fMentor = $('#f-mentor');
  let prefilled = false;

  if (params.get('embed') === '1') document.body.classList.add('is-embed');
  $('[data-print]')?.addEventListener('click', () => window.print());
  $('[data-download]')?.addEventListener('click', downloadPng);
  $('[data-generate]')?.addEventListener('click', showTicket);
  $('[data-back]')?.addEventListener('click', showSetup);
  [fName, fDate, fMentor].forEach((el) => el?.addEventListener('keydown', (e) => { if (e.key === 'Enter') showTicket(); }));

  function override(key) { return String(params.get(key) || '').trim(); }

  function fill(selector, value) {
    if (value == null) return;
    document.querySelectorAll(selector).forEach((el) => { el.textContent = value; });
  }

  function titleCase(v) {
    return String(v || '').toLocaleLowerCase('ru-RU').replace(/(^|[\s\-–—])([a-zа-яё])/g, (_, g, l) => g + l.toLocaleUpperCase('ru-RU'));
  }

  function dealNo() {
    const KX = window.KX || {};
    return String(KX.deal || override('deal') || params.get('utm_term') || '').replace(/\D/g, '');
  }

  function ticketNumber() {
    const explicit = override('ticket');
    if (explicit) return explicit.replace(/^№\s*/, '№');
    return `№KCR${dealNo() || '6709906'}`;
  }

  function parseSchedule(value) {
    const s = String(value || '').trim();
    if (!s) return { date: '', time: '' };
    const m = s.match(/^(.*?)(?:[,\s]+)(\d{1,2}:\d{2})(?::\d{2})?$/);
    if (m) return { date: m[1].replace(/[,\s]+$/, '').replace(/\s+в$/i, ''), time: m[2] };
    return { date: s, time: '' };
  }

  // Префилл формы из ссылки/amoCRM. Пустые поля заполняем, введённое пользователем не трогаем.
  function prefill() {
    const KX = window.KX || {};
    if (fName && !fName.value) fName.value = titleCase(override('name') || KX.child || '');
    if (fDate && !fDate.value) fDate.value = override('date') || KX.mk || '';
    if (fMentor && !prefilled && override('mentor')) fMentor.value = override('mentor');
    const deal = dealNo();
    const hint = $('[data-setup-deal]');
    if (hint) hint.textContent = deal ? `Сделка № ${deal}` : 'Номер сделки в ссылке не найден — заполните поля вручную.';
    prefilled = true;
  }

  // Встраивание в iframe (Tilda): сообщаем родителю высоту контента,
  // чтобы iframe подстраивался по высоте, а не растягивал билет на весь экран.
  function postHeight() {
    if (window.parent === window) return;
    const page = document.querySelector('.ticket-page');
    const h = page ? Math.ceil(page.getBoundingClientRect().height) + 24 : document.body.scrollHeight;
    try { window.parent.postMessage({ kxTicket: 'height', height: h }, '*'); } catch (e) {}
  }

  // Билет всегда одного формата (ширина DESIGN_W). На узких экранах не перестраиваем
  // макет, а равномерно ужимаем через zoom под доступную ширину.
  const DESIGN_W = 960;
  function fitTicket() {
    const ticket = document.querySelector('.ticket');
    if (!ticket || ticketView.hidden) return;
    const page = document.querySelector('.ticket-page');
    const avail = page ? page.clientWidth : DESIGN_W;
    ticket.style.zoom = Math.min(1, avail / DESIGN_W);
  }

  function showTicket() {
    const name = titleCase((fName && fName.value) || '');
    const sched = parseSchedule((fDate && fDate.value) || '');
    const mentor = ((fMentor && fMentor.value) || '').trim() || 'Темерлан';
    const deal = dealNo();

    fill('[data-name]', name || 'Ученик');
    fill('[data-date]', sched.date);
    fill('[data-time]', sched.time);
    fill('[data-mentor]', mentor);
    fill('[data-topic]', override('topic') || 'Мастер-класс по программированию');
    fill('[data-seat]', override('seat') || '10');
    fill('[data-computer]', override('computer') || '12');
    fill('[data-ticket-number]', ticketNumber());
    fill('[data-deal]', deal || '—');
    // адрес зафиксирован в вёрстке — не трогаем

    if (name) document.title = `KURSOR — билет: ${name}`;
    setup.hidden = true;
    ticketView.hidden = false;
    fitTicket();
    window.scrollTo(0, 0);
    postHeight();
  }

  function showSetup() {
    ticketView.hidden = true;
    setup.hidden = false;
    window.scrollTo(0, 0);
    postHeight();
  }

  // Скачивание билета картинкой (PNG). Рендерим только карточку .ticket.
  async function downloadPng(event) {
    const button = event.currentTarget;
    const node = document.querySelector('.ticket');
    if (!node || !window.htmlToImage) { window.print(); return; }
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Готовим…';
    // снимаем zoom — картинка всегда в полном размере (960px), независимо от экрана
    const prevZoom = node.style.zoom;
    node.style.zoom = '1';
    const options = { pixelRatio: 2, cacheBust: true, backgroundColor: '#fffaf3' };
    const who = (document.querySelector('[data-name]')?.textContent || 'bilet').trim().replace(/\s+/g, '-');
    try {
      const blob = await window.htmlToImage.toBlob(node, options);
      const href = blob ? URL.createObjectURL(blob) : await window.htmlToImage.toPng(node, options);
      const link = document.createElement('a');
      link.href = href;
      link.download = `kursor-bilet-${who}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (blob) setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch (error) {
      console.error('[kursor-ticket] download', error);
      window.print();
    } finally {
      node.style.zoom = prevZoom;
      button.disabled = false;
      button.textContent = label;
    }
  }

  // префилл сразу + когда amoCRM ответит (kx:ready)
  prefill();
  document.addEventListener('kx:ready', prefill);
  if (window.KX && window.KX.ready) prefill();

  // билет ужимается под ширину экрана; в iframe — ещё и сообщаем высоту родителю
  function refit() { fitTicket(); postHeight(); }
  window.addEventListener('resize', refit);
  window.addEventListener('load', refit);
  [150, 500, 1200].forEach((t) => setTimeout(refit, t));
  if (window.parent !== window && window.ResizeObserver) {
    const page = document.querySelector('.ticket-page');
    if (page) new ResizeObserver(postHeight).observe(page);
  }
})();
