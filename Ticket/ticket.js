(function () {
  'use strict';

  // Данные тянутся из amoCRM так же, как на остальных страницах —
  // через общий слой assets/kursor.js (window.KX + /api/lead?deal=):
  //   KX.child     — имя ребёнка
  //   KX.mk        — дата и время мастер-класса
  //   KX.mkAddress — адрес мастер-класса
  //   KX.deal      — номер сделки (для номера билета)
  // Тренера/место/компьютер/тему в amoCRM нет — их можно передать в ссылке
  // (?mentor=&seat=&computer=&topic=), иначе остаются значения по умолчанию.

  const params = new URLSearchParams(window.location.search);
  const status = document.querySelector('[data-status]');

  if (params.get('embed') === '1') document.body.classList.add('is-embed');
  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

  function override(key) {
    return String(params.get(key) || '').trim();
  }

  function fill(selector, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
  }

  function titleCase(value) {
    return String(value || '').toLocaleLowerCase('ru-RU').replace(/(^|[\s\-–—])([a-zа-яё])/g, (_, gap, letter) => gap + letter.toLocaleUpperCase('ru-RU'));
  }

  function ticketNumber(id, explicit) {
    if (explicit) return explicit.replace(/^№\s*/, '№');
    return `№KCR${id || '6709906'}`;
  }

  function parseSchedule(value) {
    const source = String(value || '').trim();
    if (!source) return { date:'', time:'' };
    const match = source.match(/^(.*?)(?:[,\s]+)(\d{1,2}:\d{2})(?::\d{2})?$/);
    if (match) return { date:match[1].replace(/[,\s]+$/,'').replace(/\s+в$/i,''), time:match[2] };
    return { date:source, time:'' };
  }

  function apply() {
    const KX = window.KX || {};
    const schedule = parseSchedule(override('date') || KX.mk);
    // имя ребёнка и мастер-класс — из amoCRM (URL-параметр, если задан, имеет приоритет)
    fill('[data-name]', titleCase(override('name') || KX.child));
    fill('[data-date]', override('date_text') || schedule.date);
    fill('[data-time]', override('time') || schedule.time);
    fill('[data-address]', override('address') || KX.mkAddress);
    // нет в amoCRM — только из ссылки (иначе остаётся значение по умолчанию из вёрстки)
    fill('[data-mentor]', override('mentor'));
    fill('[data-seat]', override('seat'));
    fill('[data-computer]', override('computer'));
    fill('[data-topic]', override('topic'));
    fill('[data-ticket-number]', ticketNumber(KX.deal, override('ticket')));

    const displayName = override('name') || KX.child;
    if (displayName) document.title = `KURSOR — билет: ${displayName}`;

    if (status) {
      const hasDeal = !!(KX.deal || override('name'));
      status.textContent = hasDeal ? '' : 'Демо-билет: добавьте к ссылке ?deal=НОМЕР_СДЕЛКИ';
      status.classList.remove('is-error');
    }
  }

  // применяем сразу (URL-оверрайды + значения по умолчанию), затем — данные из amoCRM
  apply();
  document.addEventListener('kx:ready', apply);
  if (window.KX && window.KX.ready) apply();
})();
