/* Прогон всего теста в jsdom — кликами, как ребёнок. Запуск: npm run smoke

   Скрипт не «нажимает что попало»: он читает поле робота из DOM, сам ищет
   путь до цели, ловит вспышки в игре на память и находит неверную команду.
   Каждый возраст проходится дважды:
     · «умный» — решает правильно (проверяет ветки успеха в compute)
     · «ленивый» — жмёт первое попавшееся (проверяет ветки неудачи)
   Падение = экран результата не показался или в консоли ошибка React. */
import { JSDOM } from "jsdom";
import { load } from "./_load.mjs";

const M = await load();
const { AGES, ORDER_TASKS, runProgram } = M;

let problems = [];

/* ---------- вспомогательное ----------
   Компоненты живут в node и берут setTimeout из глобали, а не из window,
   поэтому ускоряем именно глобальные таймеры. Свои паузы драйвер отмеряет
   исходными — иначе он начнёт опережать анимации. */
const RAW_TIMEOUT = globalThis.setTimeout;
const RAW_INTERVAL = globalThis.setInterval;
const sleep = (ms) => new Promise((r) => RAW_TIMEOUT(r, ms));

const SPEED = 0.12;
function speedUpTimers() {
  globalThis.setTimeout = (f, d, ...a) => RAW_TIMEOUT(f, Math.max(1, Math.round((d || 0) * SPEED)), ...a);
  globalThis.setInterval = (f, d, ...a) => RAW_INTERVAL(f, Math.max(1, Math.round((d || 0) * SPEED)), ...a);
}
function restoreTimers() {
  globalThis.setTimeout = RAW_TIMEOUT;
  globalThis.setInterval = RAW_INTERVAL;
}

async function waitFor(fn, ms = 6000, tick = 15) {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(tick);
  }
}

/* ---------- чтение поля робота из DOM ----------
   Берём разметку клеток, а не текущее положение робота: на экране
   «поиск ошибки» робот к этому моменту уже уехал с точки старта. */
function readField(doc) {
  const box = doc.querySelector("[data-field]");
  if (!box) return null;
  const [w, h] = box.dataset.field.split("x").map(Number);
  const cells = Array.from({ length: h }, () => Array(w).fill("."));
  let start = null, target = null;
  for (const el of box.querySelectorAll("[data-kind]")) {
    const x = Number(el.dataset.x), y = Number(el.dataset.y);
    if (el.dataset.kind === "wall") cells[y][x] = "#";
    if (el.dataset.kind === "target") target = { x, y };
    if (el.dataset.start === "1") start = { x, y };
  }
  if (!start || !target) return null;
  return { cells, start, target, w, h };
}

/* поиск кратчайшей программы (робот стоит лицом вправо) */
function solve(G) {
  const key = (s) => `${s.x},${s.y},${s.dir}`;
  const start = { ...G.start, dir: 1 };
  const q = [[start, []]];
  const seen = new Set([key(start)]);
  while (q.length) {
    const [s, path] = q.shift();
    if (s.x === G.target.x && s.y === G.target.y) return path;
    for (const cmd of ["F", "L", "R"]) {
      const n = { ...s };
      if (cmd === "L") n.dir = (n.dir + 3) % 4;
      else if (cmd === "R") n.dir = (n.dir + 1) % 4;
      else {
        const dx = [0, 1, 0, -1][n.dir], dy = [-1, 0, 1, 0][n.dir];
        const nx = n.x + dx, ny = n.y + dy;
        if (nx < 0 || ny < 0 || nx >= G.w || ny >= G.h || G.cells[ny][nx] === "#") continue;
        n.x = nx; n.y = ny;
      }
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      q.push([n, [...path, cmd]]);
    }
  }
  return null;
}

/* цепочка команд → чипы с множителями */
function toChips(path, mult) {
  const out = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] !== "F" || !mult) { out.push({ cmd: path[i], n: 1 }); i++; continue; }
    let run = 0;
    while (i < path.length && path[i] === "F") { run++; i++; }
    while (run > 0) { const take = Math.min(6, run); out.push({ cmd: "F", n: take }); run -= take; }
  }
  return out;
}

/* ---------- один прогон ---------- */
async function runOnce(age, mode) {
  const label = `${age}/${mode}`;
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="root"></div></body></html>`,
    { url: `https://example.test/?age=${{ junior: 7, middle: 10, senior: 14 }[age]}&name=Амир&gender=m`, pretendToBeVisual: true }
  );
  const { window } = dom;
  const doc = window.document;

  speedUpTimers();
  global.window = window;
  global.document = doc;
  /* в node 22 navigator — только для чтения, подменяем через defineProperty */
  Object.defineProperty(global, "navigator", {
    value: window.navigator, configurable: true, writable: true,
  });
  global.HTMLElement = window.HTMLElement;
  global.MouseEvent = window.MouseEvent;
  global.IS_REACT_ACT_ENVIRONMENT = false;

  const errors = [];
  const origErr = console.error;
  console.error = (...a) => { errors.push(a.join(" ")); };

  const React = (await import("react")).default;
  const { createRoot } = await import("react-dom/client");
  const App = (await load()).default;

  const click = (el) => {
    if (!el) return false;
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  };
  const all = () => [...doc.querySelectorAll("button")];
  const btns = () => all().filter((b) => !b.disabled);
  /* ищем и выключенные кнопки: «Дальше» появляется disabled, по ней
     опознаётся экран, а нажимается она уже после ответов */
  const byText = (t) => all().find((b) => b.textContent.trim() === t);
  const enabled = (t) => btns().find((b) => b.textContent.trim() === t);
  /* текст экрана без содержимого <style> */
  const text = () => {
    const root = doc.getElementById("root");
    if (!root) return "";
    let s = "";
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) s += c.data;
        else if (c.nodeType === 1 && c.tagName !== "STYLE") walk(c);
      }
    })(root);
    return s;
  };
  const at = (re) => re.test(text());
  const seen = [];

  createRoot(doc.getElementById("root")).render(React.createElement(App));
  await sleep(60);

  /* ---- интро ---- */
  const box = await waitFor(() => doc.querySelector('input[type="checkbox"]'));
  if (!box) { problems.push(`${label}: не показался экран интро`); console.error = origErr; return; }
  click(box);
  await sleep(30);
  click(enabled("Поехали"));
  await sleep(60);

  let guard = 0;
  while (guard++ < 400) {
    if (at(/KURSOR · ЗАКЛЮЧЕНИЕ/)) break;

    /* инструкция перед игрой */
    const go = enabled("Понятно, начинаем");
    if (go) { seen.push("how"); click(go); await sleep(50); continue; }

    /* вопросы и самооценка: по одному ответу в каждой группе */
    const nextBtn = byText("Дальше") || byText("Показать результат");
    if (nextBtn) {
      seen.push(nextBtn.textContent.trim() === "Дальше" ? "вопросы" : "самооценка");
      const groups = new Map();
      for (const b of btns()) {
        if (b === nextBtn) continue;
        if (!groups.has(b.parentElement)) groups.set(b.parentElement, b);
      }
      for (const b of groups.values()) { click(b); await sleep(20); }
      const go2 = enabled("Дальше") || enabled("Показать результат");
      if (!go2) { problems.push(`${label}: кнопка перехода осталась выключенной`); break; }
      click(go2);
      await sleep(60);
      continue;
    }

    /* --- память --- */
    if (at(/Блок 1 · Память · \d+ из \d+/)) {
      seen.push("память");
      const seq = [];
      /* ловим вспышки */
      const t0 = Date.now();
      while (Date.now() - t0 < 4000) {
        const lit = doc.querySelector('[data-lit="1"]');
        if (lit) {
          const c = Number(lit.dataset.cell);
          if (seq[seq.length - 1] !== c) seq.push(c);
        }
        if (doc.querySelector('[data-cell]:not([disabled])')) break;
        await sleep(4);
      }
      const need = Number(/Осталось (\d+)/.exec(text())?.[1] || seq.length);
      const cells = [...doc.querySelectorAll("[data-cell]")];
      const order = mode === "smart" && seq.length >= need
        ? seq
        : Array.from({ length: need }, (_, k) => k % cells.length);
      for (const c of order.slice(0, need)) { click(cells[c]); await sleep(20); }
      await sleep(180);
      continue;
    }

    /* --- закономерности и пространство: один из вариантов --- */
    if (at(/Блок 1 · (Закономерности|Пространство) · \d+ из \d+/)) {
      seen.push("выбор");
      const opts = [...doc.querySelectorAll("button.opt")];
      if (!opts.length) { problems.push(`${label}: нет вариантов ответа`); break; }
      click(opts[mode === "smart" ? 0 : opts.length - 1]);
      await sleep(140);
      continue;
    }

    /* --- робот --- */
    if (at(/Блок 2 · Робот · \d+ из \d+/)) {
      seen.push("робот");
      const before = /Робот · (\d+) из/.exec(text())[1];
      const mult = /значок ×1/.test(text());
      const cap = Number(/(\d+) \/ (\d+)/.exec(text())?.[2] || 6);
      const G = readField(doc);
      if (!G) { problems.push(`${label}: не удалось прочитать поле робота`); break; }

      if (mode === "smart") {
        const path = solve(G);
        const chips = toChips(path || [], mult);
        if (!path || chips.length > cap) {
          problems.push(`${label}: уровень не решается за ${cap} команд`);
          break;
        }
        for (const c of chips) {
          click(doc.querySelector(`button[data-cmd="${c.cmd}"]`));
          await sleep(12);
        }
        /* поднимаем множители у нужных чипов программы */
        for (let k = 0; k < chips.length; k++) {
          for (let b = 1; b < chips[k].n; b++) {
            click(doc.querySelector(`button[data-chip="${k}"]`));
            await sleep(12);
          }
        }
        const placed = doc.querySelectorAll("button[data-chip]").length;
        if (placed !== chips.length)
          problems.push(`${label}: собралось ${placed} команд вместо ${chips.length}`);
      } else {
        click(doc.querySelector('button[data-cmd="F"]'));
        await sleep(15);
      }
      click(enabled("Запустить"));
      const moved = await waitFor(
        () => !at(new RegExp(`Робот · ${before} из`)) || at(/Робот не доехал/),
        4000
      );
      if (!moved) { problems.push(`${label}: робот завис на уровне ${before}`); break; }
      await sleep(120);
      continue;
    }

    /* --- поиск ошибки --- */
    if (at(/Блок 2 · Поиск ошибки · \d+ из \d+/)) {
      seen.push("ошибка");
      const rows = await waitFor(() => {
        const r = [...doc.querySelectorAll("button")].filter((b) => /^\d\d/.test(b.textContent) && !b.disabled);
        return r.length ? r : null;
      }, 5000);
      if (!rows) {
        /* ответ уже дан на прошлой итерации — просто ждём перехода */
        if (/вот она|Идём дальше|путь ломается/.test(text())) { await sleep(120); continue; }
        problems.push(`${label}: программа не стала кликабельной`);
        break;
      }

      let pick = 0;
      if (mode === "smart") {
        const G = readField(doc);
        const prog = rows.map((b) => {
          const t = b.textContent;
          const cmd = t.includes("Вперёд") ? "F" : t.includes("Налево") ? "L" : "R";
          const n = Number(/×(\d+)/.exec(t)?.[1] || 1);
          return { cmd, n };
        });
        const cands = [{ cmd: "L", n: 1 }, { cmd: "R", n: 1 },
          ...Array.from({ length: 6 }, (_, k) => ({ cmd: "F", n: k + 1 }))];
        pick = prog.findIndex((_, i) =>
          cands.some((c) => runProgram(G, prog.map((x, k) => (k === i ? c : x))).reached) ||
          runProgram(G, prog.filter((_, k) => k !== i)).reached
        );
        if (pick < 0) { problems.push(`${label}: не нашлось чинимой команды`); break; }
      }
      click(rows[pick]);
      await sleep(200);
      continue;
    }

    /* --- порядок шагов --- */
    if (at(/Блок 2 · Порядок шагов · \d+ из \d+/)) {
      seen.push("порядок");
      const task = ORDER_TASKS[age].find((t) => text().includes(t.title));
      if (!task) { problems.push(`${label}: не опознал задание на порядок`); break; }
      const order = mode === "smart" ? task.steps : [...task.steps].reverse();
      for (const st of order) {
        const b = btns().find((x) => x.textContent.trim() === st);
        if (b) { click(b); await sleep(15); }
      }
      click(byText("Проверить"));
      await sleep(180);
      /* «ленивый» ошибается — вторая попытка тоже неверная */
      if (byText("Проверить")) { click(byText("Проверить")); await sleep(250); }
      continue;
    }

    problems.push(
      `${label}: непонятный экран — «${text().replace(/\s+/g, " ").slice(0, 110).trim()}»` +
      ` · кнопки: ${all().map((b) => b.textContent.trim().slice(0, 18) + (b.disabled ? "(off)" : "")).join(" | ").slice(0, 160)}` +
      ` · путь: ${seen.slice(-6).join(" → ")}`
    );
    break;
  }

  console.error = origErr;

  const t = text();
  if (!t.includes("KURSOR · ЗАКЛЮЧЕНИЕ"))
    problems.push(`${label}: не дошли до результата (шагов ${guard})`);
  else {
    for (const must of ["Три сильные стороны", "Что зафиксировала система",
                        "РЕКОМЕНДОВАННОЕ НАПРАВЛЕНИЕ", "не является"]) {
      if (!t.includes(must)) problems.push(`${label}: на результате нет блока «${must}»`);
    }
    if (/undefined|NaN|\[object Object\]/.test(t))
      problems.push(`${label}: в тексте результата undefined/NaN`);
  }

  const real = errors.filter((e) => !/not wrapped in act|ReactDOM.render/.test(e));
  if (real.length) problems.push(`${label}: ошибки React — ${real[0].slice(0, 160)}`);

  const hist = {};
  seen.forEach((s) => { hist[s] = (hist[s] || 0) + 1; });
  const path = Object.entries(hist).map(([k, v]) => `${k}×${v}`).join(" ");
  const scr = t.match(/Три сильные стороны(.{0,160})/s)?.[1] || "";
  console.log(`  ${label.padEnd(14)} шагов ${String(guard).padStart(3)} · ${path}`);
  if (scr) console.log(`  ${" ".repeat(14)} ${scr.replace(/\s+/g, " ").slice(0, 90)}`);
  restoreTimers();
  window.close();
}

/* npm run smoke -- junior smart  — прогнать только один вариант */
const argAges = process.argv.slice(2).filter((a) => AGES[a]);
const argModes = process.argv.slice(2).filter((a) => a === "smart" || a === "lazy");
const ages = argAges.length ? argAges : ["junior", "middle", "senior"];
const modes = argModes.length ? argModes : ["smart", "lazy"];

console.log("Прогон в jsdom:");
for (const age of ages) for (const mode of modes) await runOnce(age, mode);

if (problems.length) {
  console.error("\nПроблемы:");
  problems.forEach((p) => console.error("  ✗ " + p));
  process.exit(1);
}
console.log(`\n✓ все ${ages.length * modes.length} прогонов дошли до результата`);
