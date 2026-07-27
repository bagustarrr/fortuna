/* ============================================================
   KURSOR — общая логика воронки (все страницы)
   • читает номер сделки из ссылки (?deal=123 или ?utm_term=123)
   • тянет имя родителя/ребёнка и время МК из amoCRM по deal (через /api/lead)
   • ставит теги на сделку после целевого действия (через /api/tag)
   Подключается: <script src="../assets/kursor.js"></script>
   ============================================================ */
(function () {
  "use strict";

  var qs = new URLSearchParams(location.search);
  function digits(s){ return String(s || "").replace(/\D/g, ""); }

  // deal ID: приоритет ?deal=, затем ?utm_term= / ?utm_content=
  var deal = digits(qs.get("deal") || qs.get("utm_term") || qs.get("utm_content") || "");

  var KX = {
    deal: deal,
    // значения из ссылки (если менеджер их добавил) — необязательны
    client: qs.get("client") || qs.get("name") || "",
    child:  qs.get("child")  || "",
    mk:     qs.get("mk")     || qs.get("time") || "",
    ready:  false
  };
  window.KX = KX;

  function firstName(s){ return String(s || "").trim().split(/\s+/)[0] || ""; }

  function greetingText(name){
    return name ? ("Здравствуйте, " + name + "!") : "Здравствуйте!";
  }

  function render(){
    document.querySelectorAll("[data-kx-greeting]").forEach(function (el){
      el.innerHTML = greetingText(KX.client) + ' <span class="wave">👋</span>';
    });
    document.querySelectorAll("[data-kx-child]").forEach(function (el){ el.textContent = KX.child || ""; });
    document.querySelectorAll("[data-kx-mk]").forEach(function (el){ el.textContent = KX.mk || ""; });
    // элементы, которые нужно показывать только при наличии данных
    document.querySelectorAll("[data-kx-needs-child]").forEach(function (el){ el.hidden = !KX.child; });
    document.querySelectorAll("[data-kx-needs-mk]").forEach(function (el){ el.hidden = !KX.mk; });
  }

  // Подтягиваем данные из amoCRM по номеру сделки (если чего-то не хватает).
  async function personalize(){
    if (KX.deal && (!KX.client || !KX.child || !KX.mk)) {
      try {
        var r = await fetch("/api/lead?deal=" + encodeURIComponent(KX.deal));
        if (r.ok) {
          var d = await r.json();
          if (d && d.ok) {
            KX.client = KX.client || firstName(d.parentName) || "";
            KX.child  = KX.child  || d.childName || "";
            KX.mk     = KX.mk     || d.mkTime   || "";
          }
        }
      } catch (e) { /* нет сети / не задеплоено — работаем на том, что есть в ссылке */ }
    }
    KX.client = firstName(KX.client);
    KX.ready = true;
    render();
    document.dispatchEvent(new CustomEvent("kx:ready", { detail: KX }));
  }

  /* Поставить тег на сделку после целевого действия.
     event: 'video' | 'fortuna' | 'diagnostic' */
  KX.tag = async function (event){
    if (!KX.deal) return { ok: false, error: "no_deal" };
    try {
      var r = await fetch("/api/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal: KX.deal, event: event })
      });
      return await r.json().catch(function(){ return { ok: false }; });
    } catch (e) {
      return { ok: false, error: "network" };
    }
  };

  KX.render = render;
  KX.personalize = personalize;

  if (document.readyState !== "loading") personalize();
  else document.addEventListener("DOMContentLoaded", personalize);
})();
