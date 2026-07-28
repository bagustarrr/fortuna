/* Проверяет содержимое заданий перебором. Запуск: npm run validate
   1. Каждый уровень робота проходим за отведённое число команд.
   2. В каждой задаче «поиск ошибки» ровно одна команда — неверная.
   3. Генераторы закономерностей / памяти / пространства не выдают
      заданий с двумя правильными ответами.  */
import { load } from "./_load.mjs";

const M = await load();
const { ROBOT_POOLS, DEBUG_TASKS, parseGrid, runProgram, AGES,
        buildPatterns, buildMemory, buildSpatial } = M;

let fails = 0;
const fail = (msg) => { console.error("  ✗ " + msg); fails++; };

/* ---------- 1. уровни робота ----------
   BFS по состояниям (x, y, dir) даёт кратчайшую цепочку команд,
   затем считаем «фишки»: подряд идущие «Вперёд» схлопываются в одну
   команду с множителем (максимум ×6 — столько даёт кнопка). */
function shortest(G) {
  const key = (s) => `${s.x},${s.y},${s.dir}`;
  const start = { x: G.start.x, y: G.start.y, dir: 1 };
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

function chips(path, mult) {
  if (!mult) return path.length;
  let c = 0, i = 0;
  while (i < path.length) {
    if (path[i] !== "F") { c++; i++; continue; }
    let run = 0;
    while (i < path.length && path[i] === "F") { run++; i++; }
    c += Math.ceil(run / 6); /* один чип держит максимум ×6 */
  }
  return c;
}

console.log("Уровни робота:");
for (const [age, pools] of Object.entries(ROBOT_POOLS)) {
  pools.forEach((pool, pi) => {
    pool.forEach((L, li) => {
      const id = `${age} пул ${pi + 1} уровень ${li + 1}`;
      const G = parseGrid(L.g);
      if (!G.start || !G.target) return fail(`${id}: нет S или T`);
      const path = shortest(G);
      if (!path) return fail(`${id}: цель недостижима`);
      const need = chips(path, L.mult);
      if (need > L.maxChips)
        return fail(`${id}: нужно ${need} команд, разрешено ${L.maxChips}`);
      /* уровень с множителем должен реально требовать множителя,
         иначе скрытая проверка на цикл ничего не проверяет */
      if (L.mult && chips(path, false) <= L.maxChips)
        return fail(`${id}: решается и без множителя — проверка на цикл не работает`);
      if (!L.mult && need > L.maxChips)
        return fail(`${id}: без множителя не хватает команд`);
    });
  });
}
console.log(fails === 0 ? "  ✓ все уровни проходимы\n" : "");

/* ---------- 2. задачи «поиск ошибки» ----------
   Однозначность: ровно один индекс можно заменить/убрать так,
   чтобы робот дошёл до цели. Кандидаты — то, что вообще может
   стоять в программе на этом уровне. */
const before = fails;
console.log("Задачи «поиск ошибки»:");
for (const [age, tasks] of Object.entries(DEBUG_TASKS)) {
  tasks.forEach((t, ti) => {
    const id = `${age} задача ${ti + 1}`;
    const G = parseGrid(t.g);
    if (runProgram(G, t.prog).reached)
      return fail(`${id}: исходная программа и так доходит до цели`);

    const cands = t.mult
      ? [{ cmd: "L", n: 1 }, { cmd: "R", n: 1 },
         ...Array.from({ length: 6 }, (_, k) => ({ cmd: "F", n: k + 1 }))]
      : [{ cmd: "L", n: 1 }, { cmd: "R", n: 1 }, { cmd: "F", n: 1 }];

    const fixable = [];
    t.prog.forEach((_, i) => {
      let ok = false;
      for (const c of cands) {
        const p = t.prog.map((x, k) => (k === i ? c : x));
        if (JSON.stringify(p) === JSON.stringify(t.prog)) continue;
        if (runProgram(G, p).reached) { ok = true; break; }
      }
      if (!ok) {
        const p = t.prog.filter((_, k) => k !== i); /* команда лишняя */
        if (runProgram(G, p).reached) ok = true;
      }
      if (ok) fixable.push(i);
    });

    if (fixable.length !== 1)
      return fail(`${id}: чинится изменением команд ${fixable.map((x) => x + 1).join(", ") || "—"} (нужна ровно одна)`);
    if (fixable[0] !== t.bad)
      return fail(`${id}: bad=${t.bad}, а чинится команда ${fixable[0]}`);
  });
}
if (fails === before) console.log("  ✓ в каждой задаче ошибка ровно одна\n");

/* ---------- 3. генераторы ---------- */
const b2 = fails;
console.log("Генераторы заданий (300 прогонов на возраст):");
const sig = (o) => JSON.stringify(o);
for (const [age, A] of Object.entries(AGES)) {
  for (let run = 0; run < 300; run++) {
    buildPatterns(A.patterns).forEach((t, i) => {
      if (t.ans < 0) return fail(`${age}: закономерность ${i + 1} — нет правильного ответа`);
      const uniq = new Set(t.opts.map(sig));
      if (uniq.size !== t.opts.length)
        fail(`${age}: закономерность ${i + 1} — одинаковые варианты ответа`);
    });
    buildMemory(A.memory).forEach((t, i) => {
      if (t.seq.length !== A.memory.lens[i]) fail(`${age}: память ${i + 1} — не та длина`);
      if (t.seq.some((c, k) => k && c === t.seq[k - 1]))
        fail(`${age}: память ${i + 1} — две одинаковые клетки подряд`);
      if (t.seq.some((c) => c < 0 || c >= t.grid * t.grid))
        fail(`${age}: память ${i + 1} — клетка вне поля`);
    });
    buildSpatial(A.spatial).forEach((t, i) => {
      if (t.ans < 0) return fail(`${age}: пространство ${i + 1} — нет правильного ответа`);
      const uniq = new Set(t.opts.map(sig));
      if (uniq.size !== t.opts.length)
        fail(`${age}: пространство ${i + 1} — повторяющиеся варианты`);
      if (t.kind === "cubes" && t.opts.some((o) => o <= 0))
        fail(`${age}: кубики ${i + 1} — вариант ответа ≤ 0`);
    });
  }
}
if (fails === b2) console.log("  ✓ генераторы не выдают неоднозначных заданий\n");

/* ---------- 4. палитры ---------- */
const b3 = fails;
console.log("Палитры по возрастам:");
const { PALETTES } = M;
const keys = Object.keys(PALETTES.senior);
for (const [age, p] of Object.entries(PALETTES)) {
  for (const k of keys) if (p[k] === undefined) fail(`${age}: нет цвета «${k}»`);
  if (!Array.isArray(p.cube) || p.cube.length !== 3) fail(`${age}: нужно три грани кубика`);
}
/* версии должны отличаться на глаз, а не на пиксель */
for (const k of ["paper", "teal", "tealSoft"]) {
  const vals = Object.values(PALETTES).map((p) => String(p[k]).toUpperCase());
  if (new Set(vals).size !== vals.length)
    fail(`цвет «${k}» совпадает у разных возрастов — версии не различить`);
}

/* Цвета фигур несут смысл: на них построено правило «чередование цвета».
   Если два из трёх сольются, задание перестанет быть решаемым. */
const lum = (h) => {
  const v = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const MIN_SHAPE_CONTRAST = 1.6;
for (const [age, p] of Object.entries(PALETTES)) {
  if (!Array.isArray(p.shapes) || p.shapes.length !== 3) {
    fail(`${age}: нужно три цвета фигур`);
    continue;
  }
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    const c = contrast(p.shapes[i], p.shapes[j]);
    if (c < MIN_SHAPE_CONTRAST)
      fail(`${age}: фигуры ${p.shapes[i]} и ${p.shapes[j]} сливаются (контраст ${c.toFixed(2)}, нужно ${MIN_SHAPE_CONTRAST})`);
  }
  /* акцент должен читаться на белой карточке */
  const onCard = contrast(p.teal, p.card);
  if (onCard < 4.5) fail(`${age}: акцент ${p.teal} плохо читается на карточке (${onCard.toFixed(2)}, нужно 4.5)`);
}
if (fails === b3) console.log("  ✓ у трёх версий свои цвета, фигуры и акценты читаются\n");

if (fails) { console.error(`\nПровалено проверок: ${fails}`); process.exit(1); }
console.log("Всё в порядке.");
