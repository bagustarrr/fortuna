import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   ДИАГНОСТИКА KURSOR

   Блок 1 «Как ты думаешь»  — Закономерности · Память · Пространство
   Блок 2 «Алгоритмы»       — Робот · Поиск ошибки · Порядок шагов
   + вопросы о стиле мышления, самооценка, экран результата.

   Три возрастные версии: junior 6–8 · middle 9–11 · senior 12–17.
   Всё, что различается между версиями, лежит в конфиге AGES —
   новые задания добавлять туда, а не в компоненты.
   ============================================================ */

/* ============================================================
   ПАЛИТРЫ ПО ВОЗРАСТАМ
   У каждой возрастной версии свой цвет — так родителю и заказчику
   сразу видно, что версии разные, а не одна на всех.

   junior 6–8   — светлая зелёная, самая мягкая
   middle 9–11  — оранжевая
   senior 12–17 — исходная бирюзово-графитовая, «взрослая»

   Имена ключей общие для всех палитр (`teal`, `amber` и т. д.) — это
   исторические названия ролей, а не цветов: `teal` всегда «основной
   акцент», `amber` — «тёплый акцент». Менять их по всему файлу дороже,
   чем оставить как есть.
   ============================================================ */
const PALETTES = {
  junior: {
    ink: "#17130F", ink2: "#4D453E", paper: "#FFFCF5", card: "#FFFFFF",
    amber: "#FFB020", teal: "#A33B00", tealSoft: "#FFF0D9",
    muted: "#887E74", line: "#EEE4D8", ok: "#23835A", bad: "#C84B3B",
    okSoft: "#E4F3EB", badSoft: "#FBEDE9",
    cube: ["#9E3F00", "#D85B00", "#FF9238"],
    shapes: ["#F2A65A", "#6D83D8", "#4A3F55"],
  },
  middle: {
    ink: "#17130F", ink2: "#4D453E", paper: "#FFFAF3", card: "#FFFFFF",
    amber: "#FFB020", teal: "#9C3500", tealSoft: "#FFEBD3",
    muted: "#887E74", line: "#EDE1D4", ok: "#23835A", bad: "#C84B3B",
    okSoft: "#E4F3EB", badSoft: "#FBEDE9",
    cube: ["#A84300", "#D85600", "#FF9643"],
    shapes: ["#F2A65A", "#6D83D8", "#4A3F55"],
  },
  senior: {
    ink: "#17130F", ink2: "#4D453E", paper: "#FFF8EF", card: "#FFFFFF",
    amber: "#FFB020", teal: "#8F3100", tealSoft: "#FFE7CA",
    muted: "#887E74", line: "#EADCCD", ok: "#23835A", bad: "#C84B3B",
    okSoft: "#E4F3EB", badSoft: "#FBEDE9",
    cube: ["#873600", "#B94700", "#E9792D"],
    shapes: ["#F2A65A", "#6D83D8", "#4A3F55"],
  },
};

/* Активная палитра. Возраст известен один раз за сессию (приходит по ссылке
   от менеджера и в ходе теста не меняется), поэтому палитра выставляется
   один раз при старте — до того, как отрисуется первый экран. */
const C = { ...PALETTES.senior };
function applyPalette(ageKey) {
  Object.assign(C, PALETTES[ageKey] || PALETTES.senior);
}

const SANS =
  '"Manrope","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';
const SERIF = SANS;
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';


/* ============================================================
   СКЛОНЕНИЕ ИМЕНИ ПО ПАДЕЖАМ
   Учитывает русские и казахские имена. Женские имена на согласный
   (Айгерим, Айгуль, Аружан) в русском языке не склоняются.
   Род можно передать явно ("m" | "f"), иначе определяется по имени.
   ============================================================ */

/* имена, которые невозможно определить по окончанию */
const NAMES_F = new Set([
  "любовь", "нинель", "рахиль", "жанель", "айгуль", "гульнар", "динара",
  "айгерим", "аружан", "жансая", "мадина", "камила", "асель", "сауле",
  "алина", "амина", "дана", "инкар", "томирис", "сабина", "лейла",
]);
const NAMES_M = new Set([
  "никита", "илья", "лука", "савва", "фома", "данила", "гаврила",
  "мустафа", "муса", "иса", "жеке",
]);

function detectGender(name) {
  const n = name.trim().toLowerCase();
  if (NAMES_F.has(n)) return "f";
  if (NAMES_M.has(n)) return "m";
  const last = n.slice(-1);
  if (last === "а" || last === "я") return "f";
  return "m";
}

/* падежи: nom, gen (кого), dat (кому), acc (кого), ins (кем), pre (о ком) */
function declineName(name, gender) {
  const raw = (name || "").trim();
  if (!raw) return { nom: "", gen: "", dat: "", acc: "", ins: "", pre: "", g: "m" };

  const g = gender === "m" || gender === "f" ? gender : detectGender(raw);
  const last = raw.slice(-1).toLowerCase();
  const stem = raw.slice(0, -1);
  const prev = raw.slice(-2, -1).toLowerCase();
  const same = (nom) => ({ nom, gen: nom, dat: nom, acc: nom, ins: nom, pre: nom });

  /* несклоняемые окончания */
  if ("оеиуыэю".includes(last)) return { ...same(raw), g };

  /* -а */
  if (last === "а") {
    /* после к г х ж ч ш щ вместо -ы пишется -и */
    const soft = "кгхжчшщ".includes(prev);
    const insEnd = "жчшщц".includes(prev) ? "ей" : "ой";
    return {
      nom: raw,
      gen: stem + (soft ? "и" : "ы"),
      dat: stem + "е",
      acc: stem + "у",
      ins: stem + insEnd,
      pre: stem + "е",
      g,
    };
  }

  /* -я */
  if (last === "я") {
    const iya = prev === "и"; /* Мария, Наталия */
    return {
      nom: raw,
      gen: stem + "и",
      dat: stem + (iya ? "и" : "е"),
      acc: stem + "ю",
      ins: stem + (prev === "ь" ? "ёй" : "ей"),
      pre: stem + (iya ? "и" : "е"),
      g,
    };
  }

  /* женские имена на согласный и на -ь не склоняются */
  if (g === "f") return { ...same(raw), g };

  /* -й  (Андрей, Сергей) */
  if (last === "й") {
    return {
      nom: raw, gen: stem + "я", dat: stem + "ю",
      acc: stem + "я", ins: stem + "ем", pre: stem + "е", g,
    };
  }

  /* -ь  (Игорь) */
  if (last === "ь") {
    return {
      nom: raw, gen: stem + "я", dat: stem + "ю",
      acc: stem + "я", ins: stem + "ем", pre: stem + "е", g,
    };
  }

  /* мужские на согласный: Амир, Арман, Данияр */
  const insEnd = "жчшщц".includes(last) ? "ем" : "ом";
  return {
    nom: raw, gen: raw + "а", dat: raw + "у",
    acc: raw + "а", ins: raw + insEnd, pre: raw + "е", g,
  };
}

/* правильная форма слова «лет / года / год» */
function yearsWord(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "лет";
  if (b === 1) return "год";
  if (b >= 2 && b <= 4) return "года";
  return "лет";
}

/* «3 раза / 2 раза / 1 раз» */
function timesWord(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "раз";
  if (b === 1) return "раз";
  if (b >= 2 && b <= 4) return "раза";
  return "раз";
}

/* ---------- шкалы ----------
   11 измеряемых + 3 закрытых до разбора = 14 параметров. */
const SCALES = [
  { code: "ДКМ-01", name: "Декомпозиция и алгоритмизация", plain: "умение разбить задачу на шаги" },
  { code: "ИНД-02", name: "Индуктивный вывод", plain: "поиск правила по примерам" },
  { code: "МРТ-03", name: "Мысленное вращение", plain: "пространственное воображение" },
  { code: "РП-04", name: "Рабочая память", plain: "сколько удерживает в голове" },
  { code: "ВРФ-05", name: "Верификация и поиск ошибок", plain: "находит сбой в готовом решении" },
  { code: "ТФР-06", name: "Толерантность к фрустрации", plain: "устойчивость после неудачи" },
  { code: "КБГ-08", name: "Когнитивная беглость", plain: "скорость обработки" },
  { code: "БСТ-09", name: "Баланс скорости и точности", plain: "стиль принятия решения" },
  { code: "АНН-10", name: "Адаптивность к нарастающей нагрузке", plain: "поведение при росте сложности" },
  { code: "СТП-11", name: "Стратегия планирования", plain: "как строится решение" },
  { code: "МКР-13", name: "Метакогнитивная рефлексия", plain: "точность самооценки" },
];
/* разбираются только на встрече со специалистом */
const LOCKED = ["УПВ-07", "ЛКО-12", "ПКН-14"];

/* ---------- общие утилиты ---------- */
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};
const pickTwo = (a) => { const s = shuffle(a); return [s[0], s[1]]; };
const sum = (a) => a.reduce((s, x) => s + x, 0);
const rate = (a, f) => (a.length ? a.filter(f).length / a.length : 0);

/* ---------- фигуры для блока «Закономерности» ---------- */
function Glyph({ shape, fill, rot = 0, count = 1, size = 30 }) {
  const items = [];
  for (let i = 0; i < count; i++) items.push(i);
  const one = (i) => {
    const k = { fill, key: i };
    if (shape === "circle") return <circle cx="0" cy="0" r={size / 2} {...k} />;
    if (shape === "square")
      return <rect x={-size / 2} y={-size / 2} width={size} height={size} rx="3" {...k} />;
    if (shape === "tri")
      return (
        <polygon
          points={`0,${-size / 2} ${size / 2},${size / 2} ${-size / 2},${size / 2}`}
          {...k}
        />
      );
    return (
      <polygon
        points={`0,${-size / 2} ${size * 0.38},${size * 0.12} ${size * 0.14},${size * 0.12} ${size * 0.14},${size / 2} ${-size * 0.14},${size / 2} ${-size * 0.14},${size * 0.12} ${-size * 0.38},${size * 0.12}`}
        {...k}
      />
    );
  };
  const gap = size + 6;
  const startX = -((count - 1) * gap) / 2;
  /* Ряд из четырёх фигур шире базового viewBox 100×100. Делаем область
     просмотра адаптивной, чтобы крайние элементы уменьшались вместе с рядом,
     а не обрезались границами SVG. Одиночные и парные фигуры остаются прежнего размера. */
  const rowWidth = count * size + Math.max(0, count - 1) * 6;
  const viewWidth = Math.max(100, rowWidth + 20);
  return (
    <svg
      viewBox={`${-viewWidth / 2} -50 ${viewWidth} 100`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", height: "100%", minWidth: 0, overflow: "hidden" }}
    >
      <g transform={`rotate(${rot})`}>
        {items.map((i) => (
          <g key={i} transform={`translate(${startX + i * gap},0)`}>
            {one(i)}
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ============================================================
   БЛОК 1 · ИГРА 1 — ЗАКОНОМЕРНОСТИ
   Правила фиксированы по сложности, а конкретные фигуры и цвета
   выбираются случайно при каждом прохождении.
   ============================================================ */
const SHAPES = ["circle", "square", "tri", "arrow"];
/* Цвета фигур — функциональные, а не декоративные: на них построено правило
   «чередование цвета», поэтому все три обязаны различаться и по тону, и по
   светлоте. Держим их отдельным списком в палитре, а не переиспользуем
   акценты интерфейса — в оранжевой теме два акцента слишком похожи.
   Берётся в момент генерации задания, когда палитра уже применена. */
const PAL = () => C.shapes;

/* каждое правило возвращает {seq, correct, distractors} */
const RULES = {
  /* ур.1 — чередование цвета */
  altColor: () => {
    const sh = rnd(SHAPES.slice(0, 3));
    const [c1, c2] = pickTwo(PAL());
    return {
      seq: [{ shape: sh, fill: c1 }, { shape: sh, fill: c2 }, { shape: sh, fill: c1 }],
      correct: { shape: sh, fill: c2 },
      distractors: [
        { shape: sh, fill: c1 },
        { shape: rnd(SHAPES.filter((x) => x !== sh)), fill: c2 },
        { shape: rnd(SHAPES.filter((x) => x !== sh)), fill: c1 },
      ],
    };
  },
  /* ур.1 — цикл из трёх форм */
  cycleShape: () => {
    const c = rnd(PAL());
    const [a, b, d] = shuffle(SHAPES).slice(0, 3);
    return {
      seq: [{ shape: a, fill: c }, { shape: b, fill: c }, { shape: d, fill: c }],
      correct: { shape: a, fill: c },
      distractors: [
        { shape: b, fill: c },
        { shape: d, fill: c },
        { shape: a, fill: rnd(PAL().filter((x) => x !== c)) },
      ],
    };
  },
  /* ур.2 — поворот на 90° */
  rotate90: () => {
    const c = rnd(PAL());
    const start = rnd([0, 90, 180, 270]);
    const at = (k) => (start + k * 90) % 360;
    return {
      seq: [0, 1, 2].map((k) => ({ shape: "arrow", fill: c, rot: at(k) })),
      correct: { shape: "arrow", fill: c, rot: at(3) },
      distractors: [
        { shape: "arrow", fill: c, rot: at(1) },
        { shape: "arrow", fill: c, rot: at(2) },
        { shape: "arrow", fill: c, rot: (at(3) + 45) % 360 },
      ],
    };
  },
  /* ур.2 — рост количества */
  countUp: () => {
    const sh = rnd(SHAPES.slice(0, 3));
    const c = rnd(PAL());
    return {
      seq: [1, 2, 3].map((n) => ({ shape: sh, fill: c, count: n })),
      correct: { shape: sh, fill: c, count: 4 },
      distractors: [
        { shape: sh, fill: c, count: 5 },
        { shape: sh, fill: c, count: 2 },
        { shape: sh, fill: rnd(PAL().filter((x) => x !== c)), count: 4 },
      ],
    };
  },
  /* ур.3 — форма и цвет меняются вместе */
  altBoth: () => {
    const [s1, s2] = pickTwo(SHAPES.slice(0, 3));
    const [c1, c2] = pickTwo(PAL());
    return {
      seq: [{ shape: s1, fill: c1 }, { shape: s2, fill: c2 }, { shape: s1, fill: c1 }],
      correct: { shape: s2, fill: c2 },
      distractors: [
        { shape: s1, fill: c2 },
        { shape: s2, fill: c1 },
        { shape: s1, fill: c1 },
      ],
    };
  },
  /* ур.3 — поворот + смена цвета */
  rotColor: () => {
    const sh = rnd(["tri", "arrow"]);
    const [c1, c2] = pickTwo(PAL());
    const step = rnd([60, 90]);
    return {
      seq: [0, 1, 2].map((k) => ({
        shape: sh, fill: k % 2 === 0 ? c1 : c2, rot: (k * step) % 360,
      })),
      correct: { shape: sh, fill: c2, rot: (3 * step) % 360 },
      distractors: [
        { shape: sh, fill: c1, rot: (3 * step) % 360 },
        { shape: sh, fill: c2, rot: (2 * step) % 360 },
        { shape: sh, fill: c2, rot: (4 * step) % 360 },
      ],
    };
  },
  /* ур.4 — форма чередуется И количество растёт */
  shapeCount: () => {
    const [s1, s2] = pickTwo(SHAPES.slice(0, 3));
    const [c1, c2] = pickTwo(PAL());
    return {
      seq: [
        { shape: s1, fill: c1, count: 1 },
        { shape: s2, fill: c2, count: 2 },
        { shape: s1, fill: c1, count: 3 },
      ],
      correct: { shape: s2, fill: c2, count: 4 },
      distractors: [
        { shape: s1, fill: c1, count: 4 },
        { shape: s2, fill: c2, count: 3 },
        { shape: s2, fill: c1, count: 4 },
      ],
    };
  },
  /* ур.4 — цикл трёх цветов на одной форме */
  cycleColor3: () => {
    const sh = rnd(SHAPES.slice(0, 3));
    const [a, b, c] = shuffle(PAL());
    return {
      seq: [{ shape: sh, fill: a }, { shape: sh, fill: b }, { shape: sh, fill: c }],
      correct: { shape: sh, fill: a },
      distractors: [
        { shape: sh, fill: b },
        { shape: sh, fill: c },
        { shape: rnd(SHAPES.filter((x) => x !== sh)), fill: a },
      ],
    };
  },

  /* ---- ур.5, только старшая: два независимых цикла разной длины ---- */
  /* форма повторяется через 3, цвет — через 2. Чтобы не ошибиться,
     нужно вести обе линии отдельно, а не искать один общий шаблон. */
  twoCycles: () => {
    const [s1, s2, s3] = shuffle(SHAPES).slice(0, 3);
    const [c1, c2] = pickTwo(PAL());
    const shp = [s1, s2, s3, s1];
    const col = [c1, c2, c1, c2];
    return {
      seq: [0, 1, 2].map((k) => ({ shape: shp[k], fill: col[k] })),
      correct: { shape: s1, fill: c2 },
      distractors: [
        { shape: s1, fill: c1 },
        { shape: s2, fill: c2 },
        { shape: s3, fill: c2 },
      ],
    };
  },
  /* ур.5 — количество убывает, фигура поворачивается */
  countDownRot: () => {
    const c = rnd(PAL());
    const step = 90;
    return {
      seq: [0, 1, 2].map((k) => ({
        shape: "arrow", fill: c, count: 4 - k, rot: (k * step) % 360,
      })),
      correct: { shape: "arrow", fill: c, count: 1, rot: (3 * step) % 360 },
      distractors: [
        { shape: "arrow", fill: c, count: 2, rot: (3 * step) % 360 },
        { shape: "arrow", fill: c, count: 1, rot: (2 * step) % 360 },
        { shape: "arrow", fill: c, count: 4, rot: (3 * step) % 360 },
      ],
    };
  },
};

/* планы сложности: по два правила на шаг, выбирается одно */
const PATTERN_PLANS = {
  junior: [
    { lvl: 1, from: ["altColor", "cycleShape"] },
    { lvl: 1, from: ["cycleShape", "altColor"] },
    { lvl: 2, from: ["countUp", "rotate90"] },
    { lvl: 2, from: ["rotate90", "countUp"] },
  ],
  middle: [
    { lvl: 1, from: ["altColor", "cycleShape"] },
    { lvl: 1, from: ["cycleShape", "altColor"] },
    { lvl: 2, from: ["rotate90", "countUp"] },
    { lvl: 2, from: ["countUp", "rotate90"] },
    { lvl: 3, from: ["altBoth", "rotColor"] },
    { lvl: 4, from: ["shapeCount", "cycleColor3"] },
  ],
  senior: [
    { lvl: 2, from: ["rotate90", "countUp"] },
    { lvl: 3, from: ["altBoth", "rotColor"] },
    { lvl: 3, from: ["rotColor", "altBoth"] },
    { lvl: 4, from: ["shapeCount", "cycleColor3"] },
    { lvl: 5, from: ["twoCycles", "countDownRot"] },
    { lvl: 5, from: ["countDownRot", "twoCycles"] },
  ],
};

function buildPatterns(plan) {
  return plan.map((step) => {
    const rule = RULES[rnd(step.from)]();
    const opts = shuffle([rule.correct, ...rule.distractors]);
    return {
      lvl: step.lvl,
      seq: [...rule.seq, null],
      opts,
      ans: opts.indexOf(rule.correct),
    };
  });
}

/* ============================================================
   БЛОК 1 · ИГРА 2 — ПАМЯТЬ НА ПОСЛЕДОВАТЕЛЬНОСТЬ
   Клетки вспыхивают по очереди, ребёнок повторяет порядок.
   Меряет РП-04 (рабочая память): максимальная воспроизведённая длина.
   ============================================================ */
function buildMemory(spec) {
  const cells = spec.grid * spec.grid;
  return spec.lens.map((len, i) => {
    const seq = [];
    while (seq.length < len) {
      const c = Math.floor(Math.random() * cells);
      /* два одинаковых подряд визуально сливаются — не берём */
      if (seq.length && seq[seq.length - 1] === c) continue;
      seq.push(c);
    }
    return { seq, grid: spec.grid, onMs: spec.onMs, gapMs: spec.gapMs, idx: i };
  });
}

/* ============================================================
   БЛОК 1 · ИГРА 3 — ПРОСТРАНСТВО
   Два типа: посчитать кубики в постройке и найти ту же фигуру,
   только повёрнутую. Меряет МРТ-03.
   ============================================================ */

/* --- кубики: [колонка, ряд, высота стопки] --- */
const CUBE_SETS = {
  easy: [
    [[0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 1, 1]],
    [[0, 0, 2], [1, 0, 1], [1, 1, 1]],
    [[0, 0, 1], [1, 0, 2], [2, 0, 1]],
    [[0, 0, 2], [0, 1, 1], [1, 1, 1], [1, 0, 1]],
  ],
  mid: [
    [[0, 0, 2], [1, 0, 2], [2, 0, 1], [0, 1, 1], [1, 1, 1]],
    [[0, 0, 3], [1, 0, 1], [1, 1, 2], [2, 1, 1]],
    [[0, 0, 1], [1, 0, 2], [2, 0, 3], [2, 1, 1]],
    [[0, 0, 2], [1, 0, 1], [2, 0, 2], [0, 1, 1], [2, 1, 1]],
  ],
  /* в сложных постройках часть кубиков не видна — их приходится достраивать
     мысленно (кубик наверху не висит в воздухе, под ним обязательно есть опора) */
  hard: [
    [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 2], [2, 1, 1]],
    [[0, 0, 2], [1, 0, 1], [0, 1, 2], [1, 1, 3], [2, 2, 1]],
    [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 2], [2, 1, 1], [2, 2, 2]],
    [[0, 0, 2], [1, 1, 3], [1, 0, 1], [0, 1, 1], [2, 1, 2]],
  ],
};

function buildCubes(level) {
  const stacks = rnd(CUBE_SETS[level]);
  const total = sum(stacks.map((s) => s[2]));
  const pool = shuffle([total - 2, total - 1, total + 1, total + 2].filter((x) => x > 0));
  const opts = shuffle([total, ...pool.slice(0, 3)]);
  return { kind: "cubes", stacks, opts, ans: opts.indexOf(total), lvl: level === "easy" ? 1 : level === "mid" ? 2 : 3 };
}

/* --- мысленное вращение: фигуры из клеток --- */
const norm = (cells) => {
  const mnx = Math.min(...cells.map((c) => c[0]));
  const mny = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mnx, y - mny]);
};
const key = (cells) =>
  norm(cells).map((c) => c.join(",")).sort().join("|");
const rot90 = (cells) => norm(cells.map(([x, y]) => [-y, x]));
const mirror = (cells) => norm(cells.map(([x, y]) => [-x, y]));
const rotN = (cells, n) => { let c = cells; for (let i = 0; i < (n % 4 + 4) % 4; i++) c = rot90(c); return c; };
const rotKeys = (cells) => {
  const s = new Set(); let c = cells;
  for (let i = 0; i < 4; i++) { s.add(key(c)); c = rot90(c); }
  return s;
};

/* случайная связная фигура из n клеток */
function randomPoly(n) {
  const cells = [[0, 0]];
  const has = (x, y) => cells.some((c) => c[0] === x && c[1] === y);
  let guard = 0;
  while (cells.length < n && guard++ < 200) {
    const [x, y] = rnd(cells);
    const [dx, dy] = rnd([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    if (!has(x + dx, y + dy)) cells.push([x + dx, y + dy]);
  }
  return norm(cells);
}

/* сдвинуть одну клетку — получается похожая, но другая фигура */
function tweakPoly(cells) {
  for (let t = 0; t < 60; t++) {
    const c = cells.map((p) => [...p]);
    const i = Math.floor(Math.random() * c.length);
    const rest = c.filter((_, k) => k !== i);
    if (!rest.length) continue;
    const [x, y] = rnd(rest);
    const [dx, dy] = rnd([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const nx = x + dx, ny = y + dy;
    if (rest.some((p) => p[0] === nx && p[1] === ny)) continue;
    const out = norm([...rest, [nx, ny]]);
    if (key(out) !== key(cells)) return out;
  }
  return null;
}

function buildRotation(level) {
  const size = level === "easy" ? 4 : 5;
  const useMirror = level !== "easy";
  for (let attempt = 0; attempt < 80; attempt++) {
    const base = randomPoly(size);
    const rk = rotKeys(base);
    /* фигура должна быть несимметричной, иначе «повёрнутая» неотличима */
    if (rk.size < 4) continue;
    if (rk.has(key(mirror(base)))) continue; /* зеркальная копия совпала бы с поворотом */

    const correct = rotN(base, level === "easy" ? 1 : rnd([1, 2, 3]));
    const taken = new Set([key(correct)]);
    const opts = [];
    const tryAdd = (cells) => {
      if (!cells) return false;
      const k = key(cells);
      if (taken.has(k)) return false;
      if (rk.has(k)) return false; /* это тоже поворот исходной — второй правильный ответ */
      taken.add(k); opts.push(cells); return true;
    };

    if (useMirror) {
      tryAdd(rotN(mirror(base), rnd([0, 1, 2, 3])));
      if (level === "hard") tryAdd(rotN(mirror(base), rnd([0, 1, 2, 3])));
    }
    let guard = 0;
    while (opts.length < 3 && guard++ < 40) tryAdd(tweakPoly(base));
    if (opts.length < 3) continue;

    const all = shuffle([correct, ...opts.slice(0, 3)]);
    return {
      kind: "rot", base, opts: all, ans: all.indexOf(correct),
      lvl: level === "easy" ? 1 : level === "mid" ? 2 : 3,
    };
  }
  /* запасной вариант — простая L-фигура, если генератору не повезло */
  const base = norm([[0, 0], [0, 1], [0, 2], [1, 2]]);
  const correct = rot90(base);
  const all = shuffle([correct, mirror(base), rotN(mirror(base), 1), rotN(base, 2)]);
  return { kind: "rot", base, opts: all, ans: all.indexOf(correct), lvl: 1 };
}

function buildSpatial(plan) {
  return plan.map((s) =>
    s.kind === "cubes" ? buildCubes(s.lvl) : buildRotation(s.lvl)
  );
}

const SPATIAL_PLANS = {
  junior: [
    { kind: "cubes", lvl: "easy" },
    { kind: "rot", lvl: "easy" },
    { kind: "cubes", lvl: "easy" },
  ],
  middle: [
    { kind: "cubes", lvl: "easy" },
    { kind: "rot", lvl: "mid" },
    { kind: "cubes", lvl: "mid" },
    { kind: "rot", lvl: "mid" },
  ],
  senior: [
    { kind: "rot", lvl: "mid" },
    { kind: "cubes", lvl: "mid" },
    { kind: "rot", lvl: "hard" },
    { kind: "cubes", lvl: "hard" },
  ],
};

/* ============================================================
   БЛОК 2 · ИГРА 1 — РОБОТ
   . пусто, # стена, S старт, T цель. Робот смотрит вправо.
   Множитель («Вперёд ×5») — скрытая проверка на понимание цикла.
   Все уровни проверены перебором на проходимость (validate.mjs).
   ============================================================ */
const ROBOT_POOLS = {
  junior: [
    [
      { lvl: 1, maxChips: 5, mult: false, g: ["S.T"] },
      { lvl: 1, maxChips: 6, mult: false, g: ["S..", "..T"] },
      { lvl: 2, maxChips: 7, mult: false, g: ["S.#", "..#", "..T"] },
    ],
    [
      { lvl: 1, maxChips: 5, mult: false, g: ["S.T"] },
      { lvl: 1, maxChips: 6, mult: false, g: ["S..", "..T"] },
      { lvl: 2, maxChips: 7, mult: false, g: [".#T", ".#.", "S.."] },
    ],
  ],
  middle: [
    [
      { lvl: 1, maxChips: 6, mult: false, g: ["S...T"] },
      { lvl: 1, maxChips: 7, mult: false, g: ["S...", "...T"] },
      { lvl: 2, maxChips: 8, mult: false, g: ["S.#", "..#", "..T"] },
      { lvl: 3, maxChips: 3, mult: true,  g: ["S.....T"] },
      { lvl: 4, maxChips: 6, mult: true,  g: ["S.....", "#####.", "T....."] },
    ],
    [
      { lvl: 1, maxChips: 6, mult: false, g: ["S..T."] },
      { lvl: 1, maxChips: 7, mult: false, g: ["S..", "..T"] },
      { lvl: 2, maxChips: 9, mult: false, g: ["S..", "##.", "T.."] },
      { lvl: 3, maxChips: 4, mult: true,  g: ["S......", "......T"] },
      { lvl: 4, maxChips: 6, mult: true,  g: ["S......", ".#####.", ".....T."] },
    ],
    [
      { lvl: 1, maxChips: 6, mult: false, g: ["S.T.."] },
      { lvl: 1, maxChips: 7, mult: false, g: ["S....", "....T"] },
      { lvl: 2, maxChips: 8, mult: false, g: ["S#.", ".#.", "..T"] },
      { lvl: 3, maxChips: 3, mult: true,  g: ["S....T"] },
      { lvl: 4, maxChips: 6, mult: true,  g: ["T.....", "#####.", "S....."] },
    ],
  ],
  senior: [
    [
      { lvl: 2, maxChips: 8, mult: false, g: ["S.#", "..#", "..T"] },
      { lvl: 3, maxChips: 4, mult: true,  g: ["S......T"] },
      { lvl: 3, maxChips: 4, mult: true,  g: ["S......", "......T"] },
      { lvl: 4, maxChips: 6, mult: true,  g: ["S.....", "#####.", "T....."] },
      { lvl: 4, maxChips: 6, mult: true,  g: ["S......", ".#####.", ".....T."] },
    ],
    [
      { lvl: 2, maxChips: 9, mult: false, g: ["S..", "##.", "T.."] },
      { lvl: 3, maxChips: 4, mult: true,  g: ["S.......T"] },
      { lvl: 3, maxChips: 5, mult: true,  g: [".....S", "T....."] },
      { lvl: 4, maxChips: 6, mult: true,  g: ["T.....", "#####.", "S....."] },
      { lvl: 4, maxChips: 6, mult: true,  g: ["S......", "######.", "T......"] },
    ],
  ],
};

function parseGrid(g) {
  const cells = g.map((r) => r.split(""));
  let start = null, target = null;
  cells.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch === "S") start = { x, y };
      if (ch === "T") target = { x, y };
    })
  );
  return { cells, start, target, w: cells[0].length, h: cells.length };
}

/* прогон программы по полю. Возвращает кадры анимации и итог. */
function runProgram(G, prog) {
  const steps = [];
  const st = { ...G.start, dir: 1 };
  steps.push({ ...st });
  let crashed = false;
  let reached = st.x === G.target.x && st.y === G.target.y;
  let stop = reached;
  let doneAt = reached ? 0 : -1;

  for (let pi = 0; pi < prog.length && !stop; pi++) {
    const item = prog[pi];
    for (let r = 0; r < item.n; r++) {
      if (item.cmd === "L") st.dir = (st.dir + 3) % 4;
      else if (item.cmd === "R") st.dir = (st.dir + 1) % 4;
      else {
        const dx = [0, 1, 0, -1][st.dir], dy = [-1, 0, 1, 0][st.dir];
        const nx = st.x + dx, ny = st.y + dy;
        if (nx < 0 || ny < 0 || nx >= G.w || ny >= G.h || G.cells[ny][nx] === "#") crashed = true;
        else { st.x = nx; st.y = ny; }
      }
      steps.push({ ...st });
      if (crashed) { stop = true; doneAt = pi; break; }
      /* дошёл до цели — остальные команды не важны */
      if (st.x === G.target.x && st.y === G.target.y) {
        reached = true; stop = true; doneAt = pi; break;
      }
    }
  }
  return { steps, reached, crashed, doneAt };
}

/* ============================================================
   БЛОК 2 · ИГРА 2 — ПОИСК ОШИБКИ
   Программа уже написана, но робот до цели не доезжает.
   Ребёнок ищет, какая именно команда неверна. Меряет ВРФ-05.
   Однозначность каждой задачи проверена перебором (validate.mjs):
   ровно одну команду можно заменить или убрать так, чтобы дошло.
   ============================================================ */
const F = (n = 1) => ({ cmd: "F", n });
const L = { cmd: "L", n: 1 };
const R = { cmd: "R", n: 1 };

const DEBUG_TASKS = {
  junior: [
    { g: ["S..T"], prog: [F(), L, F(), F()], bad: 1, mult: false },
    { g: ["S..", "..T"], prog: [F(), F(), L, F()], bad: 2, mult: false },
  ],
  middle: [
    { g: ["S.#", "..#", "..T"], prog: [F(), R, F(), F(), R, F()], bad: 4, mult: false },
    { g: [".#T", ".#.", "S.."], prog: [F(), F(), R, F(), F()], bad: 2, mult: false },
    { g: ["S....", "....T"], prog: [F(3), R, F()], bad: 0, mult: true },
  ],
  senior: [
    { g: ["S.....", "#####.", "T....."], prog: [F(5), R, F(2), L, F(5)], bad: 3, mult: true },
    { g: ["S.....", ".....T"], prog: [F(4), R, F()], bad: 0, mult: true },
    { g: ["S......", ".#####.", ".....T."], prog: [F(6), R, F(3), R, F()], bad: 2, mult: true },
  ],
};

/* ============================================================
   БЛОК 2 · ИГРА 3 — ПОРЯДОК ШАГОВ
   Шаги алгоритма перемешаны, нужно выстроить их по порядку.
   Порядок в каждом задании строго однозначный.
   ============================================================ */
const ORDER_TASKS = {
  junior: [
    { title: "Посадить семечко", steps: [
      "Насыпать землю в горшок",
      "Сделать в земле ямку",
      "Положить в ямку семечко",
      "Полить водой",
    ]},
    { title: "Собраться в школу", steps: [
      "Проснуться",
      "Умыться",
      "Одеться",
      "Взять рюкзак и выйти",
    ]},
  ],
  middle: [
    { title: "Сделать игру про кота", steps: [
      "Придумать, что будет делать кот",
      "Нарисовать кота",
      "Написать команды движения",
      "Запустить и посмотреть, что вышло",
      "Исправить места, где кот застревает",
    ]},
    { title: "Отправить фото другу", steps: [
      "Открыть камеру",
      "Сфотографировать",
      "Открыть чат с другом",
      "Выбрать нужное фото",
      "Нажать «отправить»",
    ]},
    { title: "Робот собирает мяч", steps: [
      "Найти, где лежит мяч",
      "Посчитать, сколько шагов до него",
      "Составить команды для робота",
      "Запустить робота",
      "Проверить, что мяч собран",
    ]},
  ],
  senior: [
    { title: "Найти ошибку в программе", steps: [
      "Запустить программу",
      "Заметить, что результат неверный",
      "Найти строку, где значение стало неправильным",
      "Исправить эту строку",
      "Запустить программу заново",
      "Убедиться, что результат верный",
    ]},
    { title: "Сортировка выбором", steps: [
      "Взять список чисел",
      "Найти в нём самое маленькое число",
      "Поставить это число в начало",
      "Если остались неотсортированные числа — искать минимум среди них",
      "Повторять, пока список не закончится",
      "Получить упорядоченный список",
    ]},
    { title: "Выложить сайт в интернет", steps: [
      "Сверстать страницу",
      "Проверить, как она выглядит на телефоне",
      "Собрать файлы проекта",
      "Загрузить их на хостинг",
      "Открыть сайт по ссылке",
      "Убедиться, что всё работает",
    ]},
  ],
};

/* ============================================================
   ВОПРОСЫ О СТИЛЕ МЫШЛЕНИЯ
   Формулировки разные, измеряемое — одно и то же (v совпадает).
   ============================================================ */
const Q1_POOLS = {
  junior: [
    [
      { id: "strategy", q: "Как ты искал ответ?", opts: [
        { t: "Сразу понял, как идут фигуры", v: "global" },
        { t: "Смотрел на фигуры по очереди", v: "step" },
        { t: "Выбирал ту, что больше похожа", v: "intuit" }]},
      { id: "hard", q: "Когда стало труднее, ты...", opts: [
        { t: "Стал думать внимательнее", v: "focus" },
        { t: "Делал так же, как раньше", v: "same" },
        { t: "Хотел поскорее дальше", v: "rush" }]},
    ],
    [
      { id: "strategy", q: "Что тебе помогало?", opts: [
        { t: "Я видел правило целиком", v: "global" },
        { t: "Я сравнивал фигуры друг с другом", v: "step" },
        { t: "Я угадывал, что подходит", v: "intuit" }]},
      { id: "hard", q: "Трудные задания — это как?", opts: [
        { t: "Интересно, я старался сильнее", v: "focus" },
        { t: "Обычно, решал как всегда", v: "same" },
        { t: "Скучно, хотелось закончить", v: "rush" }]},
    ],
  ],
  middle: [
    [
      { id: "strategy", q: "Как ты искал ответ?", opts: [
        { t: "Сразу увидел правило и проверил его", v: "global" },
        { t: "Разбирал по одной фигуре и сравнивал", v: "step" },
        { t: "Выбирал то, что показалось похожим", v: "intuit" }]},
      { id: "hard", q: "Когда задание становилось сложнее, ты...", opts: [
        { t: "Стал думать внимательнее", v: "focus" },
        { t: "Делал так же, как раньше", v: "same" },
        { t: "Захотел поскорее пройти дальше", v: "rush" }]},
    ],
    [
      { id: "strategy", q: "Что помогало тебе находить нужную фигуру?", opts: [
        { t: "Я понимал правило целиком и дальше шло легко", v: "global" },
        { t: "Я проверял каждую фигуру по очереди", v: "step" },
        { t: "Я выбирал ту, что больше подходит на вид", v: "intuit" }]},
      { id: "hard", q: "Задания становились труднее. Что ты чувствовал?", opts: [
        { t: "Стало интереснее, я сосредоточился", v: "focus" },
        { t: "Ничего особенного, решал как обычно", v: "same" },
        { t: "Стало скучно, хотелось быстрее закончить", v: "rush" }]},
    ],
    [
      { id: "strategy", q: "С чего ты начинал каждое задание?", opts: [
        { t: "Смотрел на весь ряд сразу и искал закономерность", v: "global" },
        { t: "Сравнивал соседние фигуры между собой", v: "step" },
        { t: "Сразу смотрел на варианты внизу", v: "intuit" }]},
      { id: "hard", q: "Если ответ был неочевиден, ты...", opts: [
        { t: "Останавливался и разбирался спокойно", v: "focus" },
        { t: "Решал в том же темпе", v: "same" },
        { t: "Выбирал наугад и шёл дальше", v: "rush" }]},
    ],
  ],
  senior: [
    [
      { id: "strategy", q: "Как ты выстраивал решение?", opts: [
        { t: "Формулировал правило и дальше проверял им варианты", v: "global" },
        { t: "Сравнивал элементы по очереди, пока не сходилось", v: "step" },
        { t: "Опирался на общее впечатление от ряда", v: "intuit" }]},
      { id: "hard", q: "Когда сложность росла, твой подход...", opts: [
        { t: "Менялся: я начинал разбирать задачу тщательнее", v: "focus" },
        { t: "Оставался прежним", v: "same" },
        { t: "Упрощался: я быстрее выбирал вариант", v: "rush" }]},
    ],
    [
      { id: "strategy", q: "На что ты опирался в заданиях с закономерностями?", opts: [
        { t: "Выделял правило и проверял его на всём ряду", v: "global" },
        { t: "Шёл по шагам: что изменилось от фигуры к фигуре", v: "step" },
        { t: "Выбирал по совпадению внешнего вида", v: "intuit" }]},
      { id: "hard", q: "Что происходило, когда задание не поддавалось сразу?", opts: [
        { t: "Я останавливался и разбирал условие заново", v: "focus" },
        { t: "Продолжал в том же режиме", v: "same" },
        { t: "Выбирал наиболее вероятный вариант и шёл дальше", v: "rush" }]},
    ],
  ],
};

const Q2_POOLS = {
  junior: [
    [
      { id: "plan", q: "Как ты собирал команды роботу?", opts: [
        { t: "Сначала придумал весь путь", v: "global" },
        { t: "Ставил по одной команде", v: "step" },
        { t: "Пробовал, пока не вышло", v: "trial" }]},
      { id: "error", q: "Робот не доехал. Что ты делал?", opts: [
        { t: "Искал, где ошибка", v: "debug" },
        { t: "Убирал всё и начинал заново", v: "restart" },
        { t: "Хотел пропустить", v: "skip" }]},
    ],
    [
      { id: "plan", q: "Перед кнопкой «Запустить» ты...", opts: [
        { t: "Уже знал весь путь робота", v: "global" },
        { t: "Проверял команды по очереди", v: "step" },
        { t: "Просто нажимал и смотрел", v: "trial" }]},
      { id: "error", q: "Если робот свернул не туда?", opts: [
        { t: "Смотрел, какая команда лишняя", v: "debug" },
        { t: "Начинал всё сначала", v: "restart" },
        { t: "Пробовал наугад", v: "skip" }]},
    ],
  ],
  middle: [
    [
      { id: "plan", q: "Как ты собирал команды для робота?", opts: [
        { t: "Продумал весь путь, потом собрал", v: "global" },
        { t: "Ставил по одной команде и смотрел", v: "step" },
        { t: "Пробовал, пока не получилось", v: "trial" }]},
      { id: "error", q: "Что ты делал, когда робот не доезжал?", opts: [
        { t: "Искал, в каком месте ошибка", v: "debug" },
        { t: "Собирал всё заново по-другому", v: "restart" },
        { t: "Хотелось пропустить", v: "skip" }]},
    ],
    [
      { id: "plan", q: "Прежде чем нажать «Запустить», ты...", opts: [
        { t: "Мысленно прошёл весь путь робота", v: "global" },
        { t: "Проверил команды по порядку", v: "step" },
        { t: "Просто запускал и смотрел, что выйдет", v: "trial" }]},
      { id: "error", q: "Робот сбился с пути. Твой первый шаг?", opts: [
        { t: "Посмотреть, на какой команде он свернул не туда", v: "debug" },
        { t: "Очистить всё и начать заново", v: "restart" },
        { t: "Попробовать наугад другой вариант", v: "skip" }]},
    ],
    [
      { id: "plan", q: "Как ты понимал, сколько шагов нужно роботу?", opts: [
        { t: "Считал клетки заранее и сразу ставил нужное число", v: "global" },
        { t: "Добавлял по одному шагу и проверял", v: "step" },
        { t: "Ставил примерно и смотрел, что получится", v: "trial" }]},
      { id: "error", q: "Когда что-то не получалось, что было ближе к правде?", opts: [
        { t: "Я находил конкретную ошибку и исправлял её", v: "debug" },
        { t: "Я начинал решение с нуля", v: "restart" },
        { t: "Я хотел перейти к следующему заданию", v: "skip" }]},
    ],
  ],
  senior: [
    [
      { id: "plan", q: "Как ты строил программу для робота?", opts: [
        { t: "Просчитывал маршрут целиком и собирал его сразу", v: "global" },
        { t: "Наращивал по одной команде, проверяя промежуточный результат", v: "step" },
        { t: "Подбирал вариант за вариантом, пока не сошлось", v: "trial" }]},
      { id: "error", q: "Программа не отработала. Что ты делал первым?", opts: [
        { t: "Локализовал команду, после которой путь ломался", v: "debug" },
        { t: "Переписывал решение с нуля", v: "restart" },
        { t: "Менял что-нибудь наугад и запускал снова", v: "skip" }]},
    ],
    [
      { id: "plan", q: "Что было для тебя главным при сборке программы?", opts: [
        { t: "Заранее посчитать шаги и повороты", v: "global" },
        { t: "Проверять каждую команду по ходу", v: "step" },
        { t: "Быстро запустить и смотреть по результату", v: "trial" }]},
      { id: "error", q: "Как ты обычно работаешь с ошибкой?", opts: [
        { t: "Ищу конкретную причину сбоя", v: "debug" },
        { t: "Переделываю решение целиком", v: "restart" },
        { t: "Пробую другой вариант, не разбираясь", v: "skip" }]},
    ],
  ],
};

/* ============================================================
   ТЕКСТЫ ЭКРАНОВ-ИНСТРУКЦИЙ
   BASE — версия для средней группы, остальные наследуют и
   переопределяют только то, что реально отличается.
   ============================================================ */
const COPY_BASE = {
  patterns: {
    eyebrow: "Блок 1 · Закономерности",
    title: "Найди закономерность",
    steps: [
      "Наверху ряд фигур. Они меняются по какому-то правилу.",
      "Одна фигура спрятана — на её месте знак вопроса.",
      "Твоя задача: понять правило и выбрать снизу ту фигуру, что подходит.",
    ],
  },
  memory: {
    eyebrow: "Блок 1 · Память",
    title: "Повтори порядок",
    steps: [
      "Клетки будут загораться по очереди — смотри внимательно.",
      "Когда они погаснут, нажми те же клетки в том же порядке.",
      "С каждым разом последовательность становится длиннее.",
    ],
  },
  spatial: {
    eyebrow: "Блок 1 · Пространство",
    title: "Посмотри в объёме",
    steps: [
      "Иногда нужно посчитать, сколько всего кубиков в постройке.",
      "Кубик наверху не висит в воздухе — под ним обязательно есть опора, даже если её не видно.",
      "Иногда нужно найти ту же фигуру, только повёрнутую.",
    ],
  },
  robot: {
    eyebrow: "Блок 2 · Робот",
    title: "Приведи робота к цели",
    steps: [
      "Робот стоит в начале, а цель — клетка с кружком.",
      "Собери для него команды: «Вперёд», «Налево», «Направо». Робот выполнит их по порядку.",
      "Нажми «Запустить» и посмотри, дойдёт ли он. Не вышло — поправь команды и попробуй снова.",
    ],
  },
  debug: {
    eyebrow: "Блок 2 · Поиск ошибки",
    title: "Найди неверную команду",
    steps: [
      "Программа для робота уже написана, но он до цели не доезжает.",
      "Посмотри, как робот идёт, и найди команду, из-за которой всё ломается.",
      "Нажми на неё. Ошибка ровно одна.",
    ],
  },
  order: {
    eyebrow: "Блок 2 · Порядок шагов",
    title: "Расставь по порядку",
    steps: [
      "Шаги перепутаны. Нажимай на них в том порядке, в каком их нужно делать.",
      "Шаг встанет в список под своим номером. Нажми на него ещё раз, чтобы вернуть обратно.",
      "Когда все шаги на местах — нажми «Проверить».",
    ],
  },
};

const COPY_OVER = {
  junior: {
    robot: {
      eyebrow: "Мишка и мёд",
      title: "Помоги мишке дойти до мёда",
      steps: [
        "Мишка стоит в начале, а мёд — в клетке с бочонком.",
        "Нажимай кнопки «Вперёд», «Налево», «Направо» — мишка пойдёт по ним по очереди.",
        "Нажми «Запустить» и посмотри, дойдёт ли. Не вышло — поправь и попробуй снова.",
      ],
    },
    memory: {
      title: "Запомни, где горело",
      steps: [
        "Клетки будут загораться по очереди. Смотри внимательно.",
        "Потом нажми те же клетки в том же порядке.",
        "Каждый раз клеток будет чуть больше.",
      ],
    },
    spatial: {
      title: "Посчитай кубики",
      steps: [
        "Иногда нужно посчитать, сколько всего кубиков в постройке.",
        "Иногда — найти такую же фигуру, только повёрнутую.",
        "Не спеши, посмотри со всех сторон.",
      ],
    },
    debug: {
      title: "Найди, где ошибка",
      steps: [
        "Команды роботу уже написаны, но он не доезжает до цели.",
        "Посмотри, куда он поехал, и найди команду, которая мешает.",
        "Нажми на неё. Ошибка только одна.",
      ],
    },
    order: {
      title: "Что сначала, что потом",
      steps: [
        "Шаги перепутались. Нажимай их по порядку — что делают сначала, что потом.",
        "Если ошибся — нажми на шаг в списке, и он вернётся обратно.",
        "Когда всё расставишь — нажми «Проверить».",
      ],
    },
  },
  senior: {
    spatial: {
      title: "Пространственные задачи",
      steps: [
        "В части заданий нужно посчитать кубики в постройке — включая те, которых не видно.",
        "Кубик не висит в воздухе: если он наверху, под ним есть опора.",
        "В остальных — найти ту же фигуру после поворота. Зеркальная копия не считается.",
      ],
    },
    debug: {
      steps: [
        "Программа написана целиком, но робот до цели не доходит.",
        "Посмотри трассировку и определи команду, после которой путь ломается.",
        "Неверная команда ровно одна — остальные корректны.",
      ],
    },
  },
};

function resolveCopy(ageKey) {
  const over = COPY_OVER[ageKey] || {};
  const out = {};
  for (const g of Object.keys(COPY_BASE)) out[g] = { ...COPY_BASE[g], ...(over[g] || {}) };
  return out;
}

/* ============================================================
   ВОЗРАСТНЫЕ ВЕРСИИ
   ============================================================ */
const FLOW = ["patterns", "memory", "spatial", "q1", "robot", "debug", "order", "q2", "self"];
/* junior (6–8): короче и добрее — 3 интуитивные игры + один вопрос + самооценка */
const JUNIOR_FLOW = ["memory", "patterns", "robot", "q1", "self"];

const AGES = {
  junior: {
    key: "junior",
    label: "6–8 лет",
    minutes: "около 5 минут",
    blocks: "три коротких игры и вопрос",
    ui: { fs: 1.1, max: 520, cell: 62, memCell: 74 },
    flow: JUNIOR_FLOW,
    patterns: PATTERN_PLANS.junior,
    memory: { grid: 3, lens: [2, 3, 3], onMs: 800, gapMs: 320 },
    spatial: SPATIAL_PLANS.junior,
    robot: ROBOT_POOLS.junior,
    debug: DEBUG_TASKS.junior,
    order: ORDER_TASKS.junior,
    q1: Q1_POOLS.junior,
    q2: Q2_POOLS.junior,
    intro: {
      h1: ["Привет!", "Давай поиграем"],
      p1: "Тебя ждут три весёлые игры: запоминать огоньки, искать фигуры и помочь мишке дойти до мёда. Это не экзамен — тут нельзя проиграть.",
      p2: "Делай, как чувствуешь. Нам важно не сколько ты угадал, а как ты думаешь.",
      wrong: "ничего страшного, идём дальше",
    },
  },
  middle: {
    key: "middle",
    label: "9–11 лет",
    minutes: "около 12 минут",
    blocks: "два блока игр и вопросы",
    ui: { fs: 1, max: 520, cell: 56, memCell: 64 },
    flow: FLOW,
    patterns: PATTERN_PLANS.middle,
    memory: { grid: 3, lens: [3, 4, 4, 5], onMs: 600, gapMs: 220 },
    spatial: SPATIAL_PLANS.middle,
    robot: ROBOT_POOLS.middle,
    debug: DEBUG_TASKS.middle,
    order: ORDER_TASKS.middle,
    q1: Q1_POOLS.middle,
    q2: Q2_POOLS.middle,
    intro: {
      h1: ["Привет! Давай проверим,", "как ты думаешь"],
      p1: "Тебя ждут игры и головоломки: находить закономерности, запоминать, вести робота к цели и искать ошибки. Это не экзамен — здесь нельзя «провалиться».",
      p2: "Просто делай как чувствуешь. Мы смотрим не на оценки, а на то, как именно ты решаешь задачи.",
      wrong: "ничего страшного, идём дальше",
    },
  },
  senior: {
    key: "senior",
    label: "12–17 лет",
    minutes: "около 12 минут",
    blocks: "два блока задач и вопросы",
    ui: { fs: 0.98, max: 540, cell: 54, memCell: 62 },
    flow: FLOW,
    patterns: PATTERN_PLANS.senior,
    memory: { grid: 3, lens: [4, 5, 5, 6], onMs: 520, gapMs: 180 },
    spatial: SPATIAL_PLANS.senior,
    robot: ROBOT_POOLS.senior,
    debug: DEBUG_TASKS.senior,
    order: ORDER_TASKS.senior,
    q1: Q1_POOLS.senior,
    q2: Q2_POOLS.senior,
    intro: {
      h1: ["Диагностика", "познавательных способностей"],
      p1: "Шесть коротких заданий: закономерности, память, пространственные задачи, алгоритмы, поиск ошибки и порядок действий. Это не экзамен и не тест на знания.",
      p2: "Система смотрит не только на правильность, но и на то, как ты решаешь: как планируешь, как реагируешь на сложность и на ошибку.",
      wrong: "это тоже данные, идём дальше",
    },
  },
};
for (const k of Object.keys(AGES)) AGES[k].copy = resolveCopy(k);

function ageKeyFor(age) {
  const a = Number(age);
  if (!Number.isFinite(a)) return "middle";
  if (a <= 8) return "junior";
  if (a <= 11) return "middle";
  return "senior";
}

/* данные ребёнка. В боевой версии придут из amoCRM через разовую ссылку;
   параметры в адресе нужны, чтобы показывать три версии без пересборки.

   Читаем и `?age=7`, и `#age=7`: при открытии файла с диска (file://) и на
   части хостингов query-строка теряется, а хэш доходит всегда. */
function readChild() {
  const d = { name: "Амир", age: 10, gender: "m", fromUrl: false };
  try {
    if (typeof window === "undefined" || !window.location) return d;
    const q = new URLSearchParams(
      (window.location.search || "").replace(/^\?/, "") + "&" +
      (window.location.hash || "").replace(/^#/, "")
    );
    // приоритет — данные из amoCRM (window.KX), затем адрес (?age= / ?child= для тестов)
    const kx = window.KX || {};
    const name = (kx.child && String(kx.child).trim()) || q.get("name") || q.get("child");
    const ageRaw = (kx.childAge != null && kx.childAge !== "") ? kx.childAge : q.get("age");
    const age = parseInt(ageRaw, 10);
    const g = kx.childGender || q.get("gender");
    if (name && String(name).trim()) { d.name = String(name).trim(); d.fromUrl = true; }
    if (Number.isFinite(age) && age >= 4 && age <= 18) { d.age = age; d.fromUrl = true; }
    if (g === "m" || g === "f") { d.gender = g; d.fromUrl = true; }
  } catch (e) { /* нет window — работаем с дефолтом */ }
  return d;
}

/* ============================================================
   ПРИЛОЖЕНИЕ
   ============================================================ */
const AgeCtx = React.createContext(AGES.middle);
const useAge = () => React.useContext(AgeCtx);
/* размер шрифта с поправкой на возрастную версию */
function useFs() {
  const A = useAge();
  return (px) => Math.round(px * A.ui.fs * 10) / 10;
}

/* поток экранов строится из flow: перед каждой игрой — инструкция */
function buildSteps(A) {
  const steps = [{ kind: "intro" }];
  for (const g of A.flow) {
    if (g === "q1" || g === "q2" || g === "self") steps.push({ kind: g });
    else { steps.push({ kind: "how", game: g }); steps.push({ kind: "game", game: g }); }
  }
  steps.push({ kind: "result" });
  return steps;
}

export default function App() {
  const child = React.useMemo(() => {
    const c = readChild();
    const ageKey = ageKeyFor(c.age);
    /* палитру выставляем здесь: useMemo отработает до того, как
       отрисуются экраны, и все они возьмут уже нужные цвета */
    applyPalette(ageKey);
    return {
      ...c,
      n: declineName(c.name, c.gender),
      years: yearsWord(c.age),
      ageKey,
    };
  }, []);
  const A = AGES[child.ageKey];

  /* фон страницы и цвет строки браузера — под возрастную версию */
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.background = C.paper;
    document.body.style.background = C.paper;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", C.paper);
  }, [child.ageKey]);

  const [data, setData] = useState({
    patterns: [], memory: [], spatial: [],
    robot: [], debug: [], order: [],
    answers: {}, selfAssess: null,
  });

  /* вариант сессии выбирается один раз: задания, уровни и вопросы
     будут разными у каждого ребёнка */
  const [ses] = useState(() => ({
    patterns: buildPatterns(A.patterns),
    memory: buildMemory(A.memory),
    spatial: buildSpatial(A.spatial),
    levels: rnd(A.robot),
    debug: A.debug,
    order: A.order,
    q1: rnd(A.q1),
    q2: rnd(A.q2),
  }));

  const steps = React.useMemo(() => buildSteps(A), [A]);
  const [si, setSi] = useState(0);
  const step = steps[si];
  useEffect(() => {
    if (step.kind === "result" && typeof window !== "undefined" && window.KX && window.KX.tag) {
      window.KX.tag("diagnostic");
    }
  }, [step.kind]);
  const next = () => setSi((i) => Math.min(i + 1, steps.length - 1));
  const finish = (key) => (res) => {
    setData((d) => ({ ...d, [key]: res }));
    next();
  };

  const games = {
    patterns: <Patterns tasks={ses.patterns} onDone={finish("patterns")} />,
    memory: <Memory tasks={ses.memory} onDone={finish("memory")} />,
    spatial: <Spatial tasks={ses.spatial} onDone={finish("spatial")} />,
    robot: <Robot levels={ses.levels} onDone={finish("robot")} />,
    debug: <Debug tasks={ses.debug} onDone={finish("debug")} />,
    order: <Order tasks={ses.order} onDone={finish("order")} />,
  };

  const showBar = step.kind !== "intro" && step.kind !== "result";

  return (
    <AgeCtx.Provider value={A}>
      <div
        style={{
          minHeight: "100vh",
          background: C.paper,
          fontFamily: SANS,
          color: C.ink,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <style>{`
          * { box-sizing: border-box; }
          @keyframes fadeUp { from { opacity:0; transform: translateY(18px);} to {opacity:1;transform:none;} }
          @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.45 } }
          @keyframes ambient { to { transform: translate3d(0,-22px,0) scale(1.05); } }
          .fade { animation: fadeUp .62s cubic-bezier(.2,.8,.2,1) both; }
          button { font-family: inherit; cursor: pointer; }
          button:focus-visible { outline: 3px solid ${C.tealSoft}; outline-offset: 3px; }
          .opt { box-shadow: 0 8px 24px rgba(76,47,20,.05); transition: border-color .2s, transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s; }
          .opt:hover { border-color: ${C.teal} !important; transform: translateY(-3px); box-shadow: 0 14px 30px rgba(76,47,20,.10); }
          #root::before,#root::after { content:""; position:fixed; z-index:0; border-radius:999px; pointer-events:none; animation:ambient 9s ease-in-out infinite alternate; }
          #root::before { width:220px;height:220px;right:-110px;top:35%;background:rgba(255,176,32,.10); }
          #root::after { width:150px;height:150px;left:-80px;top:14%;background:rgba(91,124,250,.06);animation-delay:-4s; }
          #root > div { position:relative; z-index:1; }
          .pattern-sequence,
          .pattern-options { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
          .pattern-cell,
          .pattern-option { min-width:0; width:100%; overflow:hidden; }
          @media (hover: none) { .opt:hover { transform: none; } }
          @media (max-width: 520px) {
            .pattern-sequence { gap:5px !important; }
            .pattern-options { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px !important; }
            .pattern-cell { padding:6px !important; border-radius:12px !important; }
            .pattern-option { padding:9px !important; border-radius:16px !important; }
          }
          @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
        `}</style>

        {showBar && (
          <div style={{ maxWidth: A.ui.max, margin: "0 auto", padding: "22px 18px 0" }}>
            <Progress value={si / (steps.length - 1)} />
          </div>
        )}

        {step.kind === "intro" && <Intro child={child} onStart={next} />}

        {step.kind === "how" && (
          <HowTo game={step.game} copy={A.copy[step.game]} onStart={next} />
        )}

        {step.kind === "game" && games[step.game]}

        {step.kind === "q1" && (
          <Questions
            title="Пара вопросов"
            sub="Правильных ответов нет — расскажи, как ты решал."
            items={ses.q1}
            onDone={(a) => { setData((d) => ({ ...d, answers: { ...d.answers, ...a } })); next(); }}
          />
        )}

        {step.kind === "q2" && (
          <Questions
            title="И ещё два"
            sub="Тоже без правильных ответов."
            items={ses.q2}
            onDone={(a) => { setData((d) => ({ ...d, answers: { ...d.answers, ...a } })); next(); }}
          />
        )}

        {step.kind === "self" && (
          <SelfAssess onDone={(v) => { setData((d) => ({ ...d, selfAssess: v })); next(); }} />
        )}

        {step.kind === "result" && <Result child={child} data={data} />}
      </div>
    </AgeCtx.Provider>
  );
}

/* ============================================================
   ОБЩИЕ ЭЛЕМЕНТЫ
   ============================================================ */
function Shell({ children, max }) {
  const A = useAge();
  return (
    <div style={{ padding: "24px 18px 64px" }}>
      <div style={{ maxWidth: max || A.ui.max, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function Progress({ value }) {
  return (
    <div style={{ height: 7, background: "rgba(255,255,255,.72)", border: `1px solid ${C.line}`, borderRadius: 99, overflow: "hidden", boxShadow: "0 6px 18px rgba(76,47,20,.05)" }}>
      <div
        style={{
          height: "100%", width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: `linear-gradient(90deg, ${C.amber}, ${C.teal})`, borderRadius: 99, transition: "width .5s cubic-bezier(.2,.8,.2,1)",
        }}
      />
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: SANS, fontWeight: 800, fontSize: 10.5, letterSpacing: ".13em",
        textTransform: "uppercase", color: C.teal, marginBottom: 11,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ children, onClick, kind = "primary", disabled }) {
  const fs = useFs();
  const base = {
    border: "none", borderRadius: 17, padding: "15px 27px",
    fontSize: fs(15), fontWeight: 800, letterSpacing: "-.01em",
    transition: "opacity .2s, transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s",
    opacity: disabled ? 0.35 : 1,
  };
  const styles =
    kind === "primary"
      ? { ...base, background: `linear-gradient(110deg, #FFD84D, #FF7A18)`, color: "#281600", boxShadow: disabled ? "none" : "0 13px 30px rgba(255,122,24,.24)" }
      : { ...base, background: "rgba(255,255,255,.78)", color: C.teal, border: `1px solid ${C.line}`, boxShadow: "0 8px 22px rgba(76,47,20,.06)" };
  return (
    <button style={styles} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Head({ eyebrow, title, sub }) {
  const fs = useFs();
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 style={{ fontFamily: SERIF, fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.15, fontSize: fs(24), margin: "0 0 8px" }}>
        {title}
      </h2>
      {sub && (
        <p style={{ color: C.muted, fontSize: fs(14), margin: "0 0 20px", lineHeight: 1.5 }}>
          {sub}
        </p>
      )}
    </>
  );
}

/* ============================================================
   ЭКРАНЫ-ИНСТРУКЦИИ
   ============================================================ */
function ExamplePattern() {
  const seq = [
    { shape: "circle", fill: C.teal }, { shape: "square", fill: C.teal },
    { shape: "circle", fill: C.teal },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 7, justifyContent: "center", marginBottom: 10 }}>
        {seq.map((sp, k) => (
          <div key={k} style={{ width: 42, height: 42, background: C.card,
            border: `1px solid ${C.line}`, borderRadius: 7, padding: 7 }}>
            <Glyph {...sp} size={26} />
          </div>
        ))}
        <div style={{ width: 42, height: 42, borderRadius: 7,
          border: `1.5px dashed ${C.amber}`, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontFamily: SERIF, fontSize: 22, color: C.amber }}>?</div>
      </div>
      <div style={{ display: "flex", gap: 7, justifyContent: "center", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: C.muted }}>ответ:</span>
        <div style={{ width: 42, height: 42, background: C.card, padding: 7,
          border: `2px solid ${C.teal}`, borderRadius: 7,
          boxShadow: `0 0 0 3px ${C.tealSoft}` }}>
          <Glyph shape="square" fill={C.teal} size={26} />
        </div>
        <span style={{ fontSize: 13, color: C.muted, maxWidth: 150, textAlign: "left" }}>
          круг и квадрат чередуются
        </span>
      </div>
    </div>
  );
}

function ExampleMemory() {
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const seq = [0, 4, 5, -1];
    let k = 0;
    const iv = setInterval(() => { k = (k + 1) % seq.length; setLit(seq[k]); }, 620);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,34px)", gap: 5 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} style={{
            width: 34, height: 34, borderRadius: 6,
            background: lit === i ? C.amber : C.paper,
            transition: "background .12s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
        сначала смотришь, потом повторяешь тот же порядок
      </span>
    </div>
  );
}

function ExampleSpatial() {
  const stacks = [[0, 0, 1], [1, 0, 1], [1, 1, 1]];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flexWrap: "wrap" }}>
      <Cubes stacks={stacks} size={20} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: C.muted }}>всего</span>
        <span style={{
          background: C.card, border: `2px solid ${C.teal}`, borderRadius: 7,
          padding: "7px 14px", fontFamily: MONO, fontSize: 17, fontWeight: 700,
          boxShadow: `0 0 0 3px ${C.tealSoft}`,
        }}>3</span>
      </div>
    </div>
  );
}

function ExampleRobot() {
  const junior = useAge().key === "junior";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", gap: 5 }}>
        <div style={{ width: 44, height: 44, borderRadius: 7, background: C.paper,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {junior
            ? <span style={{ fontSize: 26, lineHeight: 1 }}>🐻</span>
            : <div style={{ width: 30, height: 30, borderRadius: 6, background: C.amber,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: "rotate(90deg)" }}>
                  <polygon points="6,1 11,10 6,7.5 1,10" fill={C.ink} />
                </svg>
              </div>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 7, background: C.paper }} />
        <div style={{ width: 44, height: 44, borderRadius: 7, background: C.tealSoft,
          border: `1.5px dashed ${C.teal}`, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          {junior
            ? <span style={{ fontSize: 24, lineHeight: 1 }}>🍯</span>
            : <div style={{ width: 9, height: 9, borderRadius: 5, background: C.teal }} />}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: C.muted }}>команды:</span>
        <span style={{ background: C.ink, color: "#fff", borderRadius: 6,
          padding: "6px 11px", fontSize: 13 }}>Вперёд</span>
        <span style={{ background: C.ink, color: "#fff", borderRadius: 6,
          padding: "6px 11px", fontSize: 13 }}>Вперёд</span>
      </div>
      <span style={{ fontSize: 13, color: C.muted }}>{junior ? "два шага — и мишка у мёда" : "два шага — и робот на цели"}</span>
    </div>
  );
}

function ExampleDebug() {
  const rows = [["Вперёд", false], ["Направо", true], ["Вперёд", false]];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 190 }}>
        {rows.map(([t, bad], i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: bad ? C.badSoft : C.card,
            border: `1.5px solid ${bad ? C.bad : C.line}`,
            borderRadius: 7, padding: "8px 12px", fontSize: 13.5,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{t}</span>
            {bad && <span style={{ marginLeft: "auto", color: C.bad, fontSize: 12 }}>здесь</span>}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
        робот свернул не туда именно на этой команде
      </span>
    </div>
  );
}

function ExampleOrder() {
  const rows = ["Взять хлеб", "Намазать масло", "Съесть"];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 190 }}>
        {rows.map((t, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, background: C.card,
            border: `1.5px solid ${C.line}`, borderRadius: 7,
            padding: "8px 12px", fontSize: 13.5,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 10, background: C.tealSoft,
              color: C.teal, fontFamily: MONO, fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{i + 1}</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 13, color: C.muted }}>сначала — первое, потом — второе</span>
    </div>
  );
}

const EXAMPLES = {
  patterns: ExamplePattern,
  memory: ExampleMemory,
  spatial: ExampleSpatial,
  robot: ExampleRobot,
  debug: ExampleDebug,
  order: ExampleOrder,
};

function HowTo({ game, copy, onStart }) {
  const fs = useFs();
  const Example = EXAMPLES[game];
  return (
    <Shell max={540}>
      <div className="fade">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1.12, fontSize: fs(30), margin: "0 0 10px" }}>
          {copy.title}
        </h2>
        <p style={{ color: C.muted, fontSize: fs(14.5), margin: "0 0 22px" }}>
          Как это работает — на примере:
        </p>

        <div style={{ background: "rgba(255,255,255,.82)", border: `1px solid rgba(255,255,255,.94)`,
          borderRadius: 24, padding: "25px 20px", marginBottom: 26, boxShadow: "0 18px 48px rgba(76,47,20,.09)", backdropFilter: "blur(12px)" }}>
          <Example />
        </div>

        <ol style={{ margin: "0 0 26px", padding: 0, listStyle: "none" }}>
          {copy.steps.map((st, i) => (
            <li key={i} style={{ display: "flex", gap: 13, marginBottom: 13,
              fontSize: fs(15.5), lineHeight: 1.5, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 25, height: 25, borderRadius: 13,
                background: C.tealSoft, color: C.teal, fontFamily: MONO, fontSize: 13,
                fontWeight: 700, display: "flex", alignItems: "center",
                justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
              <span>{st}</span>
            </li>
          ))}
        </ol>

        <Btn onClick={onStart}>Понятно, начинаем</Btn>
      </div>
    </Shell>
  );
}

/* ============================================================
   ИНТРО
   ============================================================ */
function Intro({ child, onStart }) {
  const A = useAge();
  const fs = useFs();
  const [ok, setOk] = useState(false);
  return (
    <Shell max={560}>
      <div className="fade" style={{ paddingTop: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em",
          color: C.teal, marginBottom: child.fromUrl ? 12 : 26 }}>
          KURSOR · ДИАГНОСТИКА СПОСОБНОСТЕЙ
        </div>

        {/* видно только при открытии с параметрами в адресе — чтобы при показе
            заказчику было понятно, какая именно версия сейчас на экране.
            По боевой ссылке из amoCRM параметров нет, и плашки нет. */}
        {child.fromUrl && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: C.tealSoft, color: C.ink2, border: `1px solid ${C.line}`,
            borderRadius: 20, padding: "5px 13px", fontSize: 12.5,
            marginBottom: 22,
          }}>
            <span style={{
              width: 9, height: 9, borderRadius: 5, background: C.teal, flexShrink: 0,
            }} />
            Версия {A.label} · {child.n.nom}, {child.age} {child.years}
          </div>
        )}

        <h1 style={{ fontFamily: SERIF, fontSize: fs(36), lineHeight: 1.08,
          letterSpacing: "-.05em", fontWeight: 800, margin: "0 0 20px" }}>
          {A.intro.h1[0]}<br />{A.intro.h1[1]}
        </h1>

        <p style={{ fontSize: fs(16.5), lineHeight: 1.65, color: C.ink2, margin: "0 0 14px" }}>
          {A.intro.p1}
        </p>
        <p style={{ fontSize: fs(16.5), lineHeight: 1.65, color: C.ink2, margin: "0 0 28px" }}>
          {A.intro.p2}
        </p>

        <div style={{ background: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.94)",
          borderRadius: 24, padding: "18px 21px", marginBottom: 28, boxShadow: "0 18px 48px rgba(76,47,20,.09)", backdropFilter: "blur(12px)" }}>
          {[
            ["Сколько идти", A.minutes],
            ["Заданий", A.blocks],
            ["Если ошибёшься", A.intro.wrong],
          ].map(([k, v]) => (
            /* две колонки, а не flex-wrap: длинное значение переносится
               внутри своей колонки и не съезжает под подпись */
            <div key={k} style={{
              display: "grid", gridTemplateColumns: "minmax(96px, 34%) 1fr",
              gap: 12, padding: "7px 0", fontSize: fs(14.5), alignItems: "baseline",
            }}>
              <span style={{ color: C.muted, fontSize: fs(13.5) }}>{k}</span>
              <span style={{ color: C.ink, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>

        <label style={{ display: "flex", gap: 11, alignItems: "flex-start",
          fontSize: 13, color: C.muted, lineHeight: 1.55,
          marginBottom: 24, cursor: "pointer" }}>
          <input
            type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)}
            style={{ marginTop: 3, width: 17, height: 17, accentColor: C.teal, flexShrink: 0 }}
          />
          <span>
            Я родитель и даю согласие на обработку данных ребёнка для проведения
            диагностики.
          </span>
        </label>

        <Btn onClick={onStart} disabled={!ok}>Поехали</Btn>
      </div>
    </Shell>
  );
}

/* ============================================================
   ИГРА 1 — ЗАКОНОМЕРНОСТИ
   ============================================================ */
function Patterns({ tasks, onDone }) {
  const fs = useFs();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const res = useRef([]);
  const t0 = useRef(Date.now());

  useEffect(() => { t0.current = Date.now(); }, [i]);

  const task = tasks[i];

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    res.current.push({
      lvl: task.lvl,
      correct: idx === task.ans,
      ms: Date.now() - t0.current,
    });
    setTimeout(() => {
      if (i + 1 < tasks.length) { setI(i + 1); setPicked(null); }
      else onDone(res.current);
    }, 620);
  };

  const cell = (spec, k) => (
    <div key={k} className="pattern-cell" style={{ aspectRatio: "1", background: C.card,
      border: `1px solid ${C.line}`, borderRadius: 8, padding: 10 }}>
      {spec ? (
        <Glyph {...spec} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontFamily: SERIF, fontSize: 30, color: C.amber }}>?</div>
      )}
    </div>
  );

  return (
    <Shell>
      <div style={{ marginTop: 22 }} className="fade" key={i}>
        <Head
          eyebrow={`Блок 1 · Закономерности · ${i + 1} из ${tasks.length}`}
          title="Какая фигура спряталась?"
          sub="Пойми правило ряда и выбери подходящую фигуру внизу."
        />

        <div className="pattern-sequence" style={{ gap: 9 }}>
          {task.seq.map((s, k) => cell(s, k))}
        </div>

        <Divider>ВЫБЕРИ ОТВЕТ</Divider>

        <div className="pattern-options" style={{ gap: 10 }}>
          {task.opts.map((s, k) => (
            <button
              key={k}
              onClick={() => choose(k)}
              className="opt pattern-option"
              style={{
                aspectRatio: "1", background: C.card, padding: 11,
                border: `2px solid ${picked === k ? C.teal : C.line}`,
                borderRadius: 10,
                boxShadow: picked === k ? `0 0 0 3px ${C.tealSoft}` : "0 1px 2px rgba(14,42,51,.07)",
                transform: picked === k ? "scale(0.95)" : "none",
                transition: "border-color .15s, transform .15s, box-shadow .15s",
              }}
            >
              <Glyph {...s} />
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function Divider({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "34px 0 16px" }}>
      <div style={{ flex: 1, height: 1, background: C.line }} />
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em",
        color: C.muted, whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

/* ============================================================
   ИГРА 2 — ПАМЯТЬ НА ПОСЛЕДОВАТЕЛЬНОСТЬ
   ============================================================ */
function Memory({ tasks, onDone }) {
  const A = useAge();
  const fs = useFs();
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState("show"); /* show | input | done */
  const [lit, setLit] = useState(-1);
  const [input, setInput] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const res = useRef([]);
  const t0 = useRef(Date.now());

  const task = tasks[i];

  /* показ последовательности */
  useEffect(() => {
    setPhase("show"); setInput([]); setVerdict(null); setLit(-1);
    const timers = [];
    let t = 550;
    task.seq.forEach((c) => {
      timers.push(setTimeout(() => setLit(c), t));
      t += task.onMs;
      timers.push(setTimeout(() => setLit(-1), t));
      t += task.gapMs;
    });
    timers.push(setTimeout(() => {
      setPhase("input"); t0.current = Date.now();
    }, t + 120));
    return () => timers.forEach(clearTimeout);
  }, [i, task]);

  const tap = (c) => {
    if (phase !== "input") return;
    const nextIn = [...input, c];
    setInput(nextIn);
    if (nextIn.length < task.seq.length) return;

    const ok = nextIn.every((v, k) => v === task.seq[k]);
    setVerdict(ok ? "ok" : "bad");
    setPhase("done");
    res.current.push({
      len: task.seq.length, correct: ok, ms: Date.now() - t0.current,
    });
    setTimeout(() => {
      if (i + 1 < tasks.length) setI(i + 1);
      else onDone(res.current);
    }, 950);
  };

  const cellPx = A.ui.memCell;
  const cells = task.grid * task.grid;

  return (
    <Shell>
      <div style={{ marginTop: 22 }} className="fade">
        <Head
          eyebrow={`Блок 1 · Память · ${i + 1} из ${tasks.length}`}
          title={phase === "show" ? "Смотри внимательно" : "Теперь повтори"}
          sub={
            phase === "show"
              ? `Клетки загораются по очереди. Их ${task.seq.length}.`
              : `Нажми те же клетки в том же порядке. Осталось ${task.seq.length - input.length}.`
          }
        />

        <div style={{
          background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
          padding: 18, display: "flex", justifyContent: "center", marginBottom: 16,
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${task.grid}, ${cellPx}px)`,
            gap: 7,
          }}>
            {Array.from({ length: cells }, (_, c) => {
              const on = lit === c;
              const chosen = phase !== "show" && input.includes(c);
              let bg = C.paper;
              if (on) bg = C.amber;
              else if (verdict === "ok" && chosen) bg = C.okSoft;
              else if (verdict === "bad" && chosen) bg = C.badSoft;
              else if (chosen) bg = C.tealSoft;
              return (
                <button
                  key={c}
                  onClick={() => tap(c)}
                  disabled={phase !== "input"}
                  aria-label={`клетка ${c + 1}`}
                  data-cell={c}
                  data-lit={on ? "1" : "0"}
                  style={{
                    width: cellPx, height: cellPx, borderRadius: 9,
                    border: `1.5px solid ${on ? C.amber : chosen ? C.teal : C.line}`,
                    background: bg,
                    transition: "background .12s, border-color .12s",
                    cursor: phase === "input" ? "pointer" : "default",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* индикатор длины */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14 }}>
          {task.seq.map((_, k) => (
            <div key={k} style={{
              width: 8, height: 8, borderRadius: 4,
              background: k < input.length ? C.teal : C.line,
            }} />
          ))}
        </div>

        {verdict && (
          <div style={{
            textAlign: "center", fontSize: fs(14.5),
            color: verdict === "ok" ? C.ok : C.ink2,
          }}>
            {verdict === "ok" ? "Верно" : "Не совсем — идём дальше"}
          </div>
        )}
        {phase === "show" && (
          <div style={{ textAlign: "center", fontSize: fs(13.5), color: C.muted,
            animation: "pulse 1.4s ease-in-out infinite" }}>
            запоминай…
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ============================================================
   ИГРА 3 — ПРОСТРАНСТВО
   ============================================================ */
/* изометрический рендер постройки из кубиков */
function Cubes({ stacks, size = 26 }) {
  const W = size * 0.86, H = size * 0.5, V = size;
  const list = [];
  stacks.forEach(([c, r, h]) => {
    for (let l = 0; l < h; l++) list.push([c, r, l]);
  });
  /* дальние рисуем первыми */
  list.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));

  const pt = (c, r, l) => [(c - r) * W, (c + r) * H - l * V];
  const poly = (pts) => pts.map((p) => p.join(",")).join(" ");

  const shapes = list.map(([c, r, l], i) => {
    const P = pt(c, r, l);
    const ex = [W, H], ey = [-W, H], ez = [0, -V];
    const add = (a, ...vs) => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1]], a);
    const top = [add(P, ez), add(P, ez, ex), add(P, ez, ex, ey), add(P, ez, ey)];
    const right = [add(P, ex), add(P, ex, ey), add(P, ex, ey, ez), add(P, ex, ez)];
    const left = [add(P, ey), add(P, ey, ex), add(P, ey, ex, ez), add(P, ey, ez)];
    return (
      <g key={i}>
        <polygon points={poly(left)} fill={C.cube[0]} stroke={C.ink} strokeWidth="1" strokeLinejoin="round" />
        <polygon points={poly(right)} fill={C.cube[1]} stroke={C.ink} strokeWidth="1" strokeLinejoin="round" />
        <polygon points={poly(top)} fill={C.cube[2]} stroke={C.ink} strokeWidth="1" strokeLinejoin="round" />
      </g>
    );
  });

  /* границы для viewBox */
  const xs = [], ys = [];
  list.forEach(([c, r, l]) => {
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]
      .forEach(([dc, dr, dl]) => {
        const [x, y] = pt(c + dc, r + dr, l + dl);
        xs.push(x); ys.push(y);
      });
  });
  const pad = 6;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      style={{ width: Math.min(240, (maxX - minX) * 1.15), maxWidth: "100%", height: "auto" }}
    >
      {shapes}
    </svg>
  );
}

/* фигура из клеток */
function Poly({ cells, cell = 15, color = C.teal }) {
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  return (
    <svg
      viewBox={`0 0 ${w * cell} ${h * cell}`}
      style={{ width: w * cell, height: h * cell, maxWidth: "100%" }}
    >
      {cells.map(([x, y], i) => (
        <rect
          key={i}
          x={x * cell + 1} y={y * cell + 1}
          width={cell - 2} height={cell - 2}
          rx="2.5" fill={color}
        />
      ))}
    </svg>
  );
}

function Spatial({ tasks, onDone }) {
  const fs = useFs();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const res = useRef([]);
  const t0 = useRef(Date.now());

  useEffect(() => { t0.current = Date.now(); }, [i]);

  const task = tasks[i];

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    res.current.push({
      kind: task.kind, lvl: task.lvl,
      correct: idx === task.ans,
      ms: Date.now() - t0.current,
    });
    setTimeout(() => {
      if (i + 1 < tasks.length) { setI(i + 1); setPicked(null); }
      else onDone(res.current);
    }, 620);
  };

  const optStyle = (k) => ({
    background: C.card, padding: 12,
    border: `2px solid ${picked === k ? C.teal : C.line}`,
    borderRadius: 10,
    boxShadow: picked === k ? `0 0 0 3px ${C.tealSoft}` : "0 1px 2px rgba(14,42,51,.07)",
    transform: picked === k ? "scale(0.95)" : "none",
    transition: "border-color .15s, transform .15s, box-shadow .15s",
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: 74,
  });

  return (
    <Shell>
      <div style={{ marginTop: 22 }} className="fade" key={i}>
        <Head
          eyebrow={`Блок 1 · Пространство · ${i + 1} из ${tasks.length}`}
          title={task.kind === "cubes" ? "Сколько всего кубиков?" : "Найди ту же фигуру"}
          sub={
            task.kind === "cubes"
              ? "Считай и те кубики, которых не видно: если сверху есть кубик, под ним обязательно есть опора."
              : "Одна из фигур внизу — та же самая, только повёрнутая. Зеркальная копия не подходит."
          }
        />

        <div style={{
          background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
          padding: 20, display: "flex", justifyContent: "center", marginBottom: 4,
          minHeight: 130, alignItems: "center",
        }}>
          {task.kind === "cubes"
            ? <Cubes stacks={task.stacks} size={26} />
            : <Poly cells={task.base} cell={18} color={C.ink} />}
        </div>

        <Divider>ВЫБЕРИ ОТВЕТ</Divider>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
        }}>
          {task.opts.map((o, k) => (
            <button key={k} onClick={() => choose(k)} className="opt" style={optStyle(k)}>
              {task.kind === "cubes"
                ? <span style={{ fontFamily: MONO, fontSize: fs(21), fontWeight: 700, color: C.ink }}>{o}</span>
                : <Poly cells={o} cell={13} color={C.teal} />}
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ============================================================
   ИГРА 4 — РОБОТ
   ============================================================ */
const CMD = { F: "Вперёд", L: "Налево", R: "Направо" };

/* поле робота — общий рендер для игры и для поиска ошибки.
   data-атрибуты описывают клетки: по ним поле читает автотест (smoke.mjs),
   на вид они не влияют. */
function Field({ G, pos, cellPx }) {
  const A = useAge();
  const junior = A.key === "junior";
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
      padding: 16, display: "flex", justifyContent: "center", marginBottom: 18,
    }}>
      <div
        data-field={`${G.w}x${G.h}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${G.w}, ${cellPx}px)`,
          gap: 4,
        }}
      >
        {G.cells.map((row, y) =>
          row.map((ch, x) => {
            const isRobot = pos.x === x && pos.y === y;
            const isT = G.target.x === x && G.target.y === y;
            return (
              <div
                key={`${x}-${y}`}
                data-x={x}
                data-y={y}
                data-kind={ch === "#" ? "wall" : isT ? "target" : "free"}
                data-start={G.start.x === x && G.start.y === y ? "1" : undefined}
                style={{
                  width: cellPx, height: cellPx, borderRadius: 6,
                  background: ch === "#" ? C.ink : isT ? C.tealSoft : C.paper,
                  border: isT ? `1.5px dashed ${C.teal}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}
              >
                {isT && !isRobot && (
                  junior
                    ? <div style={{ fontSize: cellPx * 0.5, lineHeight: 1 }}>🍯</div>
                    : <div style={{ width: 9, height: 9, borderRadius: 5, background: C.teal }} />
                )}
                {isRobot && (
                  junior
                    ? <div style={{ position: "relative", fontSize: cellPx * 0.56, lineHeight: 1 }}>
                        🐻
                        <span style={{
                          position: "absolute", bottom: -4, right: -5, fontSize: cellPx * 0.3,
                          color: C.amber, display: "inline-flex",
                          transform: `rotate(${pos.dir * 90}deg)`, transition: "transform .2s",
                        }}>▲</span>
                      </div>
                    : <div style={{
                        width: cellPx - 14, height: cellPx - 14, borderRadius: 6,
                        background: C.amber, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        transform: `rotate(${pos.dir * 90}deg)`,
                        transition: "transform .2s",
                      }}>
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <polygon points="6,1 11,10 6,7.5 1,10" fill={C.ink} />
                        </svg>
                      </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Robot({ levels, onDone }) {
  const A = useAge();
  const fs = useFs();
  const [li, setLi] = useState(0);
  const [prog, setProg] = useState([]);
  const [run, setRun] = useState(null);
  const [fail, setFail] = useState(false);
  const res = useRef([]);
  const attempts = useRef(0);
  const usedMult = useRef(false);
  const multAtAttempt = useRef(null);
  const t0 = useRef(Date.now());
  const timer = useRef(null);

  const L = levels[li];
  const G = parseGrid(L.g);

  useEffect(() => {
    attempts.current = 0; usedMult.current = false;
    multAtAttempt.current = null; t0.current = Date.now();
  }, [li]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const add = (cmd) => {
    if (run) return;
    if (prog.length >= L.maxChips) return;
    setProg([...prog, { cmd, n: 1 }]);
    setFail(false);
  };

  const bump = (idx) => {
    if (run || !L.mult) return;
    const p = prog.map((x) => ({ ...x }));
    if (p[idx].cmd !== "F") return;
    p[idx].n = p[idx].n >= 6 ? 1 : p[idx].n + 1;
    if (p[idx].n > 1) {
      if (!usedMult.current) multAtAttempt.current = attempts.current;
      usedMult.current = true;
    }
    setProg(p);
  };

  /* убирает только последнюю команду — не приходится собирать всё заново */
  const undo = () => {
    if (run || !prog.length) return;
    setProg(prog.slice(0, -1));
    setFail(false);
  };
  const clearAll = () => { if (!run) { setProg([]); setFail(false); } };

  const record = (solved) => ({
    lvl: L.lvl, solved, attempts: attempts.current,
    usedMult: usedMult.current, multAvailable: !!L.mult,
    selfDiscovered: multAtAttempt.current === 0,
    ms: Date.now() - t0.current,
  });

  const execute = () => {
    if (!prog.length || run) return;
    attempts.current += 1;
    const { steps, reached } = runProgram(G, prog);

    let k = 0;
    setRun(steps[0]);
    timer.current = setInterval(() => {
      k += 1;
      if (k < steps.length) { setRun(steps[k]); return; }
      clearInterval(timer.current); timer.current = null;
      setTimeout(() => {
        if (reached) {
          res.current.push(record(true));
          if (li + 1 < levels.length) {
            setLi(li + 1); setProg([]); setRun(null); setFail(false);
          } else onDone(res.current);
          return;
        }
        setRun(null); setFail(true);
        /* после четырёх попыток идём дальше — это тоже данные (ТФР-06) */
        if (attempts.current >= 4) {
          res.current.push(record(false));
          if (li + 1 < levels.length) { setLi(li + 1); setProg([]); setFail(false); }
          else onDone(res.current);
        }
      }, 340);
    }, 340);
  };

  const pos = run || { ...G.start, dir: 1 };
  const cellPx = Math.min(A.ui.cell, Math.floor(300 / G.w));

  return (
    <Shell>
      <div style={{ marginTop: 22 }} className="fade" key={li}>
        <Head
          eyebrow={`${A.key === "junior" ? "Мишка и мёд" : "Блок 2 · Робот"} · ${li + 1} из ${levels.length}`}
          title={A.key === "junior" ? "Помоги мишке дойти до мёда" : "Приведи робота к кружку"}
          sub={
            A.key === "junior"
              ? "Нажимай кнопки внизу — мишка пойдёт по ним по очереди. Дойди до бочки с мёдом 🍯"
              : L.mult
                ? `Команд мало — всего ${L.maxChips}, а идти далеко. Нажимай на жёлтый значок ×1 у команды «Вперёд» — цифра вырастет, и робот повторит шаг столько раз. Так один «Вперёд ×5» заменяет пять команд.`
                : `Нажимай на кнопки внизу — команды встанут по очереди. Их можно поставить до ${L.maxChips}.`
          }
        />

        <Field G={G} pos={pos} cellPx={cellPx} />

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: ".08em" }}>
            ПРОГРАММА
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12,
            color: prog.length >= L.maxChips ? C.amber : C.muted }}>
            {prog.length} / {L.maxChips}
          </span>
        </div>

        <div style={{
          minHeight: 52, background: C.card, border: `1px dashed ${C.line}`,
          borderRadius: 8, padding: 9, marginBottom: 12,
          display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center",
        }}>
          {prog.length === 0 && (
            <span style={{ color: C.muted, fontSize: 13.5, padding: "0 6px" }}>
              Команды появятся здесь
            </span>
          )}
          {prog.map((p, k) => {
            const adj = L.mult && p.cmd === "F";
            return (
              <button
                key={k}
                onClick={() => bump(k)}
                data-chip={k}
                aria-label={`команда ${k + 1}: ${CMD[p.cmd]}${p.n > 1 ? ` ×${p.n}` : ""}`}
                style={{
                  background: C.ink, color: "#fff", border: "none",
                  borderRadius: 6, padding: adj ? "6px 6px 6px 12px" : "8px 12px",
                  fontSize: 13.5, fontWeight: 500,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                <span>{CMD[p.cmd]}</span>
                {adj && (
                  <span style={{
                    fontFamily: MONO, fontSize: 13, fontWeight: 700,
                    color: C.ink, background: C.amber,
                    borderRadius: 4, padding: "3px 7px",
                    display: "inline-flex", alignItems: "center", gap: 3,
                  }}>
                    ×{p.n}
                    <span style={{ fontSize: 10, opacity: 0.65 }}>▲</span>
                  </span>
                )}
                {!adj && p.n > 1 && (
                  <span style={{ fontFamily: MONO, color: C.amber }}>×{p.n}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
          {["F", "L", "R"].map((c) => (
            <button
              key={c}
              onClick={() => add(c)}
              data-cmd={c}
              style={{
                flex: "1 1 90px", background: C.card, border: `1.5px solid ${C.line}`,
                borderRadius: 8, padding: "12px 8px", fontSize: fs(14), color: C.ink,
                opacity: prog.length >= L.maxChips ? 0.4 : 1,
              }}
            >
              {CMD[c]}
            </button>
          ))}
        </div>

        {fail && (
          <div style={{
            fontSize: fs(14), color: C.ink2, background: C.tealSoft,
            padding: "11px 14px", borderRadius: 7, marginBottom: 13,
          }}>
            {A.key === "junior"
              ? "Мишка не дошёл. Посмотри, где он свернул не туда, и попробуй ещё раз 🐻"
              : L.mult
                ? "Робот не доехал. Подсказка: нажми на жёлтый значок ×1 рядом с командой «Вперёд» — робот повторит шаг несколько раз."
                : "Робот не доехал. Посмотри, где сбился путь, и попробуй ещё раз."}
          </div>
        )}

        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <Btn onClick={execute} disabled={!prog.length || !!run}>Запустить</Btn>
          <Btn onClick={undo} kind="ghost" disabled={!prog.length || !!run}>
            Убрать последнюю
          </Btn>
          {prog.length > 1 && !run && (
            <button
              onClick={clearAll}
              style={{
                background: "none", border: "none", color: C.muted,
                fontSize: 13.5, padding: "8px 6px", textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              убрать все
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ============================================================
   ИГРА 5 — ПОИСК ОШИБКИ
   ============================================================ */
function Debug({ tasks, onDone }) {
  const A = useAge();
  const fs = useFs();
  const [i, setI] = useState(0);
  const [pos, setPos] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState(null);
  const res = useRef([]);
  const t0 = useRef(Date.now());
  const timer = useRef(null);

  const task = tasks[i];
  const G = parseGrid(task.g);

  const play = React.useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    const { steps } = runProgram(G, task.prog);
    let k = 0;
    setPlaying(true);
    setPos(steps[0]);
    timer.current = setInterval(() => {
      k += 1;
      if (k < steps.length) { setPos(steps[k]); return; }
      clearInterval(timer.current); timer.current = null;
      setPlaying(false);
    }, 340);
  }, [task]);

  useEffect(() => {
    t0.current = Date.now();
    setPicked(null);
    setPos({ ...G.start, dir: 1 });
    const start = setTimeout(play, 450);
    return () => {
      clearTimeout(start);
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    };
  }, [i, play]);

  const choose = (idx) => {
    if (picked !== null || playing) return;
    setPicked(idx);
    res.current.push({
      correct: idx === task.bad,
      ms: Date.now() - t0.current,
      mult: !!task.mult,
    });
    setTimeout(() => {
      if (i + 1 < tasks.length) setI(i + 1);
      else onDone(res.current);
    }, 900);
  };

  const cellPx = Math.min(A.ui.cell, Math.floor(300 / G.w));
  const shown = pos || { ...G.start, dir: 1 };

  return (
    <Shell>
      <div style={{ marginTop: 22 }} className="fade" key={i}>
        <Head
          eyebrow={`Блок 2 · Поиск ошибки · ${i + 1} из ${tasks.length}`}
          title="Какая команда неверная?"
          sub="Робот выполняет программу целиком, но до кружка не доходит. Ошибка ровно одна — нажми на неё."
        />

        <Field G={G} pos={shown} cellPx={cellPx} />

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: ".08em" }}>
            ПРОГРАММА
          </span>
          <button
            onClick={play}
            disabled={playing}
            style={{
              background: "none", border: "none", color: playing ? C.muted : C.teal,
              fontSize: 13.5, padding: "4px 2px", textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {playing ? "робот идёт…" : "показать ещё раз"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {task.prog.map((p, k) => {
            const on = picked === k;
            const isBad = picked !== null && k === task.bad;
            const wrongPick = on && k !== task.bad;
            return (
              <button
                key={k}
                onClick={() => choose(k)}
                disabled={picked !== null || playing}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  textAlign: "left",
                  background: isBad ? C.okSoft : wrongPick ? C.badSoft : C.card,
                  border: `1.5px solid ${isBad ? C.ok : wrongPick ? C.bad : C.line}`,
                  borderRadius: 8, padding: "12px 14px", fontSize: fs(15), color: C.ink,
                  opacity: playing ? 0.55 : 1,
                  transition: "background .15s, border-color .15s, opacity .2s",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted }}>
                  {String(k + 1).padStart(2, "0")}
                </span>
                <span style={{ fontWeight: 500 }}>{CMD[p.cmd]}</span>
                {p.n > 1 && (
                  <span style={{
                    fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: C.ink,
                    background: C.amber, borderRadius: 4, padding: "2px 7px",
                  }}>×{p.n}</span>
                )}
                {isBad && (
                  <span style={{ marginLeft: "auto", fontSize: 13, color: C.ok }}>
                    вот она
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div style={{
            fontSize: fs(14), color: C.ink2,
            background: picked === task.bad ? C.okSoft : C.tealSoft,
            padding: "11px 14px", borderRadius: 7,
          }}>
            {picked === task.bad
              ? "Верно — именно на этой команде путь ломается."
              : "Ошибка была в другой команде — она подсвечена. Идём дальше."}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ============================================================
   ИГРА 6 — ПОРЯДОК ШАГОВ
   ============================================================ */
function Order({ tasks, onDone }) {
  const fs = useFs();
  const [i, setI] = useState(0);
  const [placed, setPlaced] = useState([]);   /* индексы шагов в выбранном порядке */
  const [shuf, setShuf] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const attempts = useRef(0);
  const res = useRef([]);
  const t0 = useRef(Date.now());

  const task = tasks[i];

  useEffect(() => {
    /* перемешиваем так, чтобы исходный порядок не выпал случайно */
    let order = task.steps.map((_, k) => k);
    for (let g = 0; g < 20; g++) {
      order = shuffle(task.steps.map((_, k) => k));
      if (order.some((v, k) => v !== k)) break;
    }
    setShuf(order);
    setPlaced([]); setVerdict(null);
    attempts.current = 0;
    t0.current = Date.now();
  }, [i, task]);

  const put = (idx) => {
    if (verdict === "ok") return;
    if (placed.includes(idx)) return;
    setPlaced([...placed, idx]);
    setVerdict(null);
  };
  const take = (idx) => {
    if (verdict === "ok") return;
    setPlaced(placed.filter((x) => x !== idx));
    setVerdict(null);
  };

  const check = () => {
    if (placed.length !== task.steps.length) return;
    attempts.current += 1;
    const ok = placed.every((v, k) => v === k);
    if (ok || attempts.current >= 2) {
      setVerdict(ok ? "ok" : "over");
      res.current.push({
        correct: ok,
        firstTry: ok && attempts.current === 1,
        attempts: attempts.current,
        steps: task.steps.length,
        ms: Date.now() - t0.current,
      });
      setTimeout(() => {
        if (i + 1 < tasks.length) setI(i + 1);
        else onDone(res.current);
      }, 1100);
    } else {
      setVerdict("retry");
    }
  };

  const left = shuf.filter((k) => !placed.includes(k));

  return (
    <Shell>
      <div style={{ marginTop: 22 }} className="fade" key={i}>
        <Head
          eyebrow={`Блок 2 · Порядок шагов · ${i + 1} из ${tasks.length}`}
          title={task.title}
          sub="Нажимай на шаги в том порядке, в каком их нужно делать. Нажми на шаг в списке, чтобы вернуть его обратно."
        />

        {/* собранный порядок */}
        <div style={{
          background: C.card, border: `1px dashed ${C.line}`, borderRadius: 9,
          padding: 10, marginBottom: 16, minHeight: 62,
          display: "flex", flexDirection: "column", gap: 7,
        }}>
          {placed.length === 0 && (
            <span style={{ color: C.muted, fontSize: 13.5, padding: "10px 6px" }}>
              Здесь появится твой порядок
            </span>
          )}
          {placed.map((idx, k) => {
            const right = verdict && verdict !== "retry" ? idx === k : null;
            return (
              <button
                key={idx}
                onClick={() => take(idx)}
                style={{
                  display: "flex", alignItems: "center", gap: 11, width: "100%",
                  textAlign: "left",
                  background: right === true ? C.okSoft : right === false ? C.badSoft : C.card,
                  border: `1.5px solid ${right === true ? C.ok : right === false ? C.bad : C.line}`,
                  borderRadius: 8, padding: "11px 13px", fontSize: fs(14.5),
                  color: C.ink, lineHeight: 1.4,
                }}
              >
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: 11,
                  background: C.tealSoft, color: C.teal, fontFamily: MONO,
                  fontSize: 11.5, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{k + 1}</span>
                <span>{task.steps[idx]}</span>
              </button>
            );
          })}
        </div>

        {/* оставшиеся шаги */}
        {left.length > 0 && (
          <>
            <Divider>ОСТАЛОСЬ РАССТАВИТЬ</Divider>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {left.map((idx) => (
                <button
                  key={idx}
                  onClick={() => put(idx)}
                  className="opt"
                  style={{
                    width: "100%", textAlign: "left", background: C.card,
                    border: `1.5px solid ${C.line}`, borderRadius: 8,
                    padding: "12px 14px", fontSize: fs(14.5), color: C.ink,
                    lineHeight: 1.4, transition: "border-color .15s, transform .15s",
                  }}
                >
                  {task.steps[idx]}
                </button>
              ))}
            </div>
          </>
        )}

        {verdict === "retry" && (
          <div style={{
            fontSize: fs(14), color: C.ink2, background: C.tealSoft,
            padding: "11px 14px", borderRadius: 7, marginBottom: 13,
          }}>
            Не совсем. Посмотри ещё раз — что должно быть раньше, а что позже.
          </div>
        )}
        {verdict === "ok" && (
          <div style={{
            fontSize: fs(14), color: C.ok, background: C.okSoft,
            padding: "11px 14px", borderRadius: 7, marginBottom: 13,
          }}>
            Верно, порядок правильный.
          </div>
        )}
        {verdict === "over" && (
          <div style={{
            fontSize: fs(14), color: C.ink2, background: C.tealSoft,
            padding: "11px 14px", borderRadius: 7, marginBottom: 13,
          }}>
            Не сошлось — идём дальше. Зелёным отмечены шаги, стоявшие на своих местах.
          </div>
        )}

        {!verdict || verdict === "retry" ? (
          <Btn onClick={check} disabled={placed.length !== task.steps.length}>
            Проверить
          </Btn>
        ) : null}
      </div>
    </Shell>
  );
}

/* ============================================================
   ВОПРОСЫ И САМООЦЕНКА
   ============================================================ */
function Questions({ title, sub, items, onDone }) {
  const fs = useFs();
  const [a, setA] = useState({});
  const done = items.every((x) => a[x.id]);
  return (
    <Shell max={540}>
      <div className="fade" style={{ marginTop: 22 }}>
        <Eyebrow>Между блоками</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: fs(26), margin: "0 0 6px" }}>
          {title}
        </h2>
        <p style={{ color: C.muted, fontSize: fs(14.5), margin: "0 0 26px" }}>{sub}</p>

        {items.map((item) => (
          <div key={item.id} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: fs(16), fontWeight: 600, marginBottom: 11 }}>{item.q}</div>
            {item.opts.map((o) => {
              const on = a[item.id] === o.v;
              return (
                <button
                  key={o.v}
                  onClick={() => setA({ ...a, [item.id]: o.v })}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: on ? C.tealSoft : C.card,
                    border: `1.5px solid ${on ? C.teal : C.line}`,
                    borderRadius: 8, padding: "13px 16px", marginBottom: 8,
                    fontSize: fs(15), color: C.ink, transition: "all .15s",
                    lineHeight: 1.4,
                  }}
                >
                  {o.t}
                </button>
              );
            })}
          </div>
        ))}

        <Btn onClick={() => onDone(a)} disabled={!done}>Дальше</Btn>
      </div>
    </Shell>
  );
}

function SelfAssess({ onDone }) {
  const fs = useFs();
  const [v, setV] = useState(null);
  return (
    <Shell max={540}>
      <div className="fade" style={{ marginTop: 22 }}>
        <Eyebrow>Последний вопрос</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: fs(26), margin: "0 0 8px" }}>
          Как думаешь, сколько ты решил правильно?
        </h2>
        <p style={{ color: C.muted, fontSize: fs(14.5), margin: "0 0 24px" }}>
          Это не проверка. Нам важно, насколько точно ты себя оцениваешь.
        </p>
        {[
          ["Почти всё", "high"],
          ["Больше половины", "mid"],
          ["Примерно половину", "half"],
          ["Меньше половины", "low"],
        ].map(([t, val]) => {
          const on = v === val;
          return (
            <button
              key={val}
              onClick={() => setV(val)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: on ? C.tealSoft : C.card,
                border: `1.5px solid ${on ? C.teal : C.line}`,
                borderRadius: 8, padding: "14px 16px", marginBottom: 8,
                fontSize: fs(15), color: C.ink,
              }}
            >
              {t}
            </button>
          );
        })}
        <div style={{ marginTop: 18 }}>
          <Btn onClick={() => onDone(v)} disabled={!v}>Показать результат</Btn>
        </div>
      </div>
    </Shell>
  );
}

/* ============================================================
   РАСЧЁТ ПРОФИЛЯ
   Все значения выводятся только из фактов сессии.
   Нормировка — внутри профиля одного ребёнка, с мягким сжатием
   у верхнего края, чтобы сильные стороны не слипались в 97.
   ============================================================ */
function compute(data, n) {
  const P = data.patterns || [], M = data.memory || [], S = data.spatial || [];
  const R = data.robot || [], D = data.debug || [], O = data.order || [];
  const A = data.answers || {};

  /* --- закономерности --- */
  const pCorrect = P.filter((x) => x.correct).length;
  const pRate = rate(P, (x) => x.correct);
  const pMaxLvl = Math.max(0, ...P.filter((x) => x.correct).map((x) => x.lvl));

  /* --- память --- */
  const mRate = rate(M, (x) => x.correct);
  const mSpan = Math.max(0, ...M.filter((x) => x.correct).map((x) => x.len));
  const mOffered = Math.max(1, ...M.map((x) => x.len));

  /* --- пространство --- */
  const sRate = rate(S, (x) => x.correct);
  const sHard = S.filter((x) => x.lvl >= 2);
  const sHardRate = rate(sHard, (x) => x.correct);

  /* --- робот --- */
  const rRate = rate(R, (x) => x.solved);
  const rMaxLvl = Math.max(0, ...R.filter((x) => x.solved).map((x) => x.lvl));
  const retried = R.filter((x) => x.attempts > 1);
  const persisted = retried.filter((x) => x.solved).length;
  const multChance = R.filter((x) => x.multAvailable);
  const multUsed = multChance.filter((x) => x.usedMult).length;
  const multSelf = multChance.filter((x) => x.selfDiscovered).length;

  /* --- поиск ошибки --- */
  const dRate = rate(D, (x) => x.correct);
  const dMs = D.length ? sum(D.map((x) => x.ms)) / D.length : 20000;

  /* --- порядок шагов --- */
  const oRate = rate(O, (x) => x.correct);
  const oFirst = O.filter((x) => x.firstTry).length;
  const oRetried = O.filter((x) => x.attempts > 1);
  const oPersisted = oRetried.filter((x) => x.correct).length;

  /* --- темп: только задания с одиночным выбором, они сопоставимы --- */
  const quick = [...P, ...S];
  const avgMs = quick.length ? sum(quick.map((x) => x.ms)) / quick.length : 9000;

  /* точность по всем играм с однозначным «верно/неверно».
     В расчёт идут только сыгранные игры; ноль — это тоже результат,
     отбрасывать его нельзя, иначе самооценка сравнивается не с тем. */
  const accParts = [[P, pRate], [M, mRate], [S, sRate],
                    [R, rRate], [D, dRate], [O, oRate]]
    .filter(([arr]) => arr.length).map(([, v]) => v);
  const acc = accParts.length ? sum(accParts) / accParts.length : 0;

  /* мягкое сжатие у верхнего края */
  const clamp = (v) => {
    let x = Math.max(6, v);
    if (x > 78) x = 78 + (x - 78) * 0.42;
    return Math.round(Math.max(6, Math.min(94, x)));
  };

  const s = {};
  s["ДКМ-01"] = clamp(rRate * 48 + rMaxLvl * 8 + (multUsed ? 12 : 0) + oRate * 14);
  s["ИНД-02"] = clamp(pRate * 66 + pMaxLvl * 8);
  s["МРТ-03"] = clamp(sRate * 58 + sHardRate * 26 + 8);
  s["РП-04"] = clamp((mSpan / mOffered) * 56 + mRate * 32 + 6);
  s["ВРФ-05"] = clamp(dRate * 66 + (dRate > 0.5 && dMs < 15000 ? 16 : 6));
  s["ТФР-06"] = clamp(
    retried.length || oRetried.length
      ? ((persisted + oPersisted) / (retried.length + oRetried.length)) * 74 + 18
      : 58 + rRate * 20
  );
  /* беглость — это скорость ВЕРНЫХ решений. Без поправки на точность
     ребёнок, который просто щёлкает наугад, получал бы её в сильные стороны. */
  const speed = avgMs < 4000 ? 88 : avgMs < 7000 ? 72 : avgMs < 11000 ? 56 : 40;
  s["КБГ-08"] = clamp(speed * (0.35 + 0.65 * Math.min(1, acc / 0.7)));
  s["БСТ-09"] = clamp(acc * 55 + (avgMs > 5000 && acc > 0.6 ? 32 : 14));
  const lateP = P.length ? P.slice(-3).filter((x) => x.correct).length / Math.min(3, P.length) : 0;
  const lateS = S.length ? (S.slice(-2).filter((x) => x.correct).length / Math.min(2, S.length)) : 0;
  s["АНН-10"] = clamp(lateP * 42 + lateS * 18 + rMaxLvl * 8 + 12);
  s["СТП-11"] = clamp(
    (A.plan === "global" ? 76 : A.plan === "step" ? 60 : 42) +
    (A.strategy === "global" ? 10 : 0) +
    (oFirst === O.length && O.length ? 8 : 0)
  );
  const claimed = { high: 0.9, mid: 0.7, half: 0.5, low: 0.3 }[data.selfAssess] ?? 0.5;
  s["МКР-13"] = clamp(92 - Math.abs(claimed - acc) * 130);

  const top = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 3);

  /* ---------- наблюдения: только из фактов ---------- */
  const N = n?.nom || "Ребёнок";
  const f = n?.g === "f";
  /* согласование по роду: v("сократил") → «сократил» или «сократила» */
  const v = (m, fem) => (f ? (fem || m + "а") : m);
  const sam = f ? "сама" : "сам";
  const notes = [];

  if (multSelf > 0)
    notes.push(
      `${N} ${sam}, без подсказки, ${v("сократил")} повторяющиеся команды в одну — это принцип цикла, которому ${f ? "её" : "его"} не обучали.`
    );
  else if (multUsed > 0)
    notes.push(
      `${N} ${v("разобрался", "разобралась")}, как заменить повторяющиеся команды одной, и дальше ${v("применял")} это ${sam} — принцип цикла усвоен с первого раза.`
    );

  if (persisted > 0)
    notes.push(
      `Не ${v("отступил")} после неудачи: ${v("возвращался", "возвращалась")} к задаче и ${v("доводил")} её до конца — ${persisted} ${timesWord(persisted)} из ${retried.length}.`
    );

  if (mSpan >= 5)
    notes.push(
      `${v("Удержал", "Удержала")} в памяти последовательность из ${mSpan} шагов и ${v("воспроизвёл", "воспроизвела")} её без ошибок.`
    );
  else if (M.length && mRate === 1)
    notes.push(`Все последовательности ${v("повторил", "повторила")} без единой ошибки.`);

  if (D.length && dRate === 1)
    notes.push(
      "Находит ошибку в чужой программе — это отдельный навык, он не совпадает с умением написать своё решение."
    );

  if (sHard.length && sHardRate === 1)
    notes.push(
      `В пространственных задачах ${v("достроил", "достроила")} то, чего не видно на картинке — считает скрытые кубики и узнаёт фигуру после поворота.`
    );

  if (P.length && pCorrect >= P.length - 1)
    notes.push(`В блоке на закономерности почти не ${v("ошибался", "ошибалась")}.`);

  if (O.length && oFirst === O.length)
    notes.push("Шаги алгоритма расставляет по порядку сразу, без перебора вариантов.");

  if (avgMs < 4500 && acc >= 0.7)
    notes.push(
      `${N} решает быстро и при этом точно — редкое сочетание для этого возраста.`
    );

  if (A.error === "debug")
    notes.push("При ошибке ищет конкретное место сбоя, а не переделывает всё заново.");

  if (rMaxLvl >= 3)
    notes.push(`${v("Дошёл", "Дошла")} до заданий повышенной сложности и ${v("справился", "справилась")} с ними.`);

  if (!notes.length)
    notes.push(`${N} ${v("прошёл", "прошла")} диагностику полностью, все задания выполнены до конца.`);

  /* ---------- направление — по тому, какая пара шкал сильнее ---------- */
  const dirScores = {
    "Разработка игр и интерактивных сред": s["ДКМ-01"] * 1.0 + s["МРТ-03"] * 0.6,
    "Веб-разработка и интерфейсы": s["ДКМ-01"] * 0.7 + s["БСТ-09"] * 0.9,
    "Логика и анализ данных": s["ИНД-02"] * 1.0 + s["МКР-13"] * 0.6,
    "Алгоритмы и робототехника": s["ДКМ-01"] * 0.8 + s["ТФР-06"] * 0.8,
    "Цифровая графика и 3D": s["МРТ-03"] * 1.0 + s["КБГ-08"] * 0.5,
    "Тестирование и качество ПО": s["ВРФ-05"] * 1.0 + s["РП-04"] * 0.5,
  };
  const dir = Object.entries(dirScores).sort((a, b) => b[1] - a[1])[0][0];

  return { scores: s, top, notes: notes.slice(0, 4), dir };
}

/* дата отчёта */
function today() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/* встреча приходит из amoCRM (window.KX.mk / mkAddress); адрес — дефолт школы */
const MEETING = { when: "уточнит менеджер", where: "ул. Жумабека Ташенова, 8" };

/* экспорт данных и чистых функций — для build/validate/smoke скриптов.
   На сборку index.html не влияет: там импортируется только default. */
export {
  AGES, ageKeyFor, SCALES, LOCKED, PALETTES, ROBOT_POOLS, DEBUG_TASKS, ORDER_TASKS,
  PATTERN_PLANS, SPATIAL_PLANS, parseGrid, runProgram, compute,
  buildPatterns, buildMemory, buildSpatial, declineName, yearsWord,
};

/* ============================================================
   ЭКРАН РЕЗУЛЬТАТА (для родителя)
   ============================================================ */
function Result({ child, data }) {
  const { top, notes, dir } = compute(data, child.n);
  const meta = (code) => SCALES.find((x) => x.code === code);
  const hidden = SCALES.length + LOCKED.length - top.length;

  return (
    <Shell max={620}>
      <div className="fade" style={{ paddingTop: 10 }}>
        {/* шапка отчёта */}
        <div style={{
          borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 26,
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".16em", color: C.teal }}>
              KURSOR · ЗАКЛЮЧЕНИЕ
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 27, marginTop: 6 }}>
              {child.n.nom}, {child.age} {child.years}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted, textAlign: "right" }}>
            {today()}<br />
            <span style={{ color: C.teal }}>{SCALES.length + LOCKED.length} параметров</span>
          </div>
        </div>

        {/* сильные стороны */}
        <Eyebrow>Три сильные стороны</Eyebrow>
        {top.map(([code, val], idx) => {
          const m = meta(code);
          return (
            <div
              key={code}
              style={{
                background: C.card, border: `1px solid ${C.line}`,
                borderLeft: `3px solid ${idx === 0 ? C.amber : C.teal}`,
                borderRadius: 8, padding: "16px 18px", marginBottom: 10,
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", gap: 12, marginBottom: 5,
              }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted, letterSpacing: ".08em" }}>
                  {code}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 19, color: C.ink, fontWeight: 600 }}>
                  {val}
                </div>
              </div>
              <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.3 }}>{m.name}</div>
              <div style={{
                height: 4, background: C.line, borderRadius: 2,
                marginTop: 11, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${val}%`,
                  background: idx === 0 ? C.amber : C.teal,
                }} />
              </div>
            </div>
          );
        })}

        {/* наблюдения */}
        <div style={{ marginTop: 30 }}>
          <Eyebrow>Что зафиксировала система</Eyebrow>
          <div style={{
            background: C.card, border: `1px solid ${C.line}`,
            borderRadius: 8, padding: "6px 18px",
          }}>
            {notes.map((n, i) => (
              <div
                key={i}
                style={{
                  padding: "13px 0", fontSize: 15, lineHeight: 1.55,
                  borderBottom: i < notes.length - 1 ? `1px solid ${C.line}` : "none",
                  display: "flex", gap: 12,
                }}
              >
                <span style={{ color: C.amber, fontFamily: MONO, fontSize: 13, marginTop: 2 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* закрытая часть */}
        <div style={{ marginTop: 30 }}>
          <Eyebrow>Остальные параметры</Eyebrow>
          <div style={{
            background: C.card, border: `1px solid ${C.line}`,
            borderRadius: 8, padding: 18, position: "relative", overflow: "hidden",
          }}>
            <div style={{ filter: "blur(4.5px)", opacity: 0.55, userSelect: "none" }}>
              {[...SCALES.slice(3), ...LOCKED.map((c) => ({ code: c, name: "—" }))]
                .slice(0, 7)
                .map((sc, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "8px 0", fontSize: 14, gap: 10,
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>
                      {sc.code}
                    </span>
                    <span style={{ flex: 1 }}>{sc.name}</span>
                    <span style={{ fontFamily: MONO, fontWeight: 600 }}>
                      {60 + ((i * 13) % 30)}
                    </span>
                  </div>
                ))}
            </div>

            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(255,255,255,.55)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center", padding: 22,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 10 }}>
                <rect x="4" y="10" width="16" height="11" rx="2.5" fill={C.ink} />
                <path d="M8 10V7a4 4 0 118 0v3" stroke={C.ink} strokeWidth="2" fill="none" />
              </svg>
              <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 4 }}>
                Ещё {hidden} параметров измерено
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, maxWidth: 330 }}>
                Полный профиль, расшифровку каждого параметра и рекомендации
                специалист разбирает лично
              </div>
            </div>
          </div>
        </div>

        {/* направление — закрыто до встречи */}
        <div style={{
          marginTop: 22, background: C.ink, borderRadius: 8,
          padding: "22px 24px", color: "#fff", position: "relative",
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em",
            color: C.amber, marginBottom: 10,
          }}>
            РЕКОМЕНДОВАННОЕ НАПРАВЛЕНИЕ
          </div>
          <div style={{
            fontFamily: SERIF, fontSize: 21, lineHeight: 1.3,
            filter: "blur(7px)", opacity: 0.45, userSelect: "none",
          }}>
            {dir}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            marginTop: 14, paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <rect x="4" y="10" width="16" height="11" rx="2.5" fill={C.amber} />
              <path d="M8 10V7a4 4 0 118 0v3" stroke={C.amber} strokeWidth="2" fill="none" />
            </svg>
            <span style={{ fontSize: 13.5, color: "rgba(255,255,255,.72)", lineHeight: 1.45 }}>
              Направление определено. Специалист назовёт его и объяснит, почему
              именно это подходит {child.n.dat}
            </span>
          </div>
        </div>

        {/* следующий шаг */}
        <div style={{
          marginTop: 22, border: `1px solid ${C.line}`, background: C.card,
          borderRadius: 8, padding: "22px 22px 24px",
        }}>
          <div style={{ fontFamily: SERIF, fontSize: 20, marginBottom: 9 }}>
            Разбор результатов
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: C.ink2, margin: "0 0 18px" }}>
            Специалист разберёт профиль {child.n.gen} лично: что стоит за каждым
            параметром, где сильные стороны и что с ними делать дальше. Разбор
            занимает около 15 минут и проводится индивидуально.
          </p>
          <div style={{
            display: "flex", gap: 12, alignItems: "baseline",
            fontSize: 15, marginBottom: 20, flexWrap: "wrap",
          }}>
            <span style={{ color: C.muted, fontSize: 13 }}>Ваша встреча</span>
            <span style={{ fontWeight: 600 }}>{(typeof window !== "undefined" && window.KX && window.KX.mk) || MEETING.when}</span>
            <span style={{ color: C.muted, fontSize: 13.5 }}>· {(typeof window !== "undefined" && window.KX && window.KX.mkAddress) || MEETING.where}</span>
          </div>
          <Btn onClick={() => {}}>Подтвердить, что придём</Btn>
        </div>

        <div style={{
          marginTop: 26, fontSize: 12, color: C.muted, lineHeight: 1.55,
          fontFamily: MONO,
        }}>
          Диагностика оценивает познавательные процессы и не является
          психологическим или медицинским заключением.
        </div>
      </div>
    </Shell>
  );
}
