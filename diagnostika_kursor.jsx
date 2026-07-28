import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   ДИАГНОСТИКА KURSOR — прототип (этап 1)
   Блок 1: Закономерности · Блок 2: Робот
   + вопросы о стиле мышления + экран результата
   ============================================================ */

const C = {
  ink: "#0E2A33",
  ink2: "#16404C",
  paper: "#EEF2F1",
  card: "#FFFFFF",
  amber: "#E0973A",
  teal: "#1B7A8C",
  tealSoft: "#E3EFF1",
  muted: "#6C7F84",
  line: "#D9E2E1",
  ok: "#3E8E68",
};

const SANS =
  '"Inter","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';
const SERIF = 'Georgia,"Times New Roman",serif';
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
  const G = g; /* род нужен для согласования глаголов */

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

/* ---------- шкалы ---------- */
const SCALES = [
  { code: "ДКМ-01", name: "Декомпозиция и алгоритмизация", plain: "умение разбить задачу на шаги" },
  { code: "ИНД-02", name: "Индуктивный вывод", plain: "поиск правила по примерам" },
  { code: "ТФР-06", name: "Толерантность к фрустрации", plain: "устойчивость после неудачи" },
  { code: "КБГ-08", name: "Когнитивная беглость", plain: "скорость обработки" },
  { code: "БСТ-09", name: "Баланс скорости и точности", plain: "стиль принятия решения" },
  { code: "АНН-10", name: "Адаптивность к нарастающей нагрузке", plain: "поведение при росте сложности" },
  { code: "СТП-11", name: "Стратегия планирования", plain: "как строится решение" },
  { code: "МКР-13", name: "Метакогнитивная рефлексия", plain: "точность самооценки" },
];
const LOCKED = [
  "МРТ-03", "РП-04", "ВРФ-05", "УПВ-07", "ЛКО-12", "ПКН-14",
];

/* ---------- фигуры для блока 1 ---------- */
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
  return (
    <svg viewBox="-50 -50 100 100" style={{ width: "100%", height: "100%" }}>
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

const T = C.teal, A = C.amber, D = C.ink;

/* 7 заданий: от простого к сложному */
/* ---------- ГЕНЕРАТОР ЗАДАНИЙ БЛОКА 1 ----------
   Правила фиксированы по сложности, а конкретные фигуры и цвета
   выбираются случайно при каждом прохождении. */
const SHAPES = ["circle", "square", "tri", "arrow"];
const PAL = [C.teal, C.amber, C.ink];

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

/* каждое правило возвращает {seq, correct, distractors} */
const RULES = {
  /* ур.1 — чередование цвета */
  altColor: () => {
    const sh = rnd(SHAPES.slice(0, 3));
    const [c1, c2] = pickTwo(PAL);
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
    const c = rnd(PAL);
    const [a, b, d] = shuffle(SHAPES).slice(0, 3);
    return {
      seq: [{ shape: a, fill: c }, { shape: b, fill: c }, { shape: d, fill: c }],
      correct: { shape: a, fill: c },
      distractors: [
        { shape: b, fill: c },
        { shape: d, fill: c },
        { shape: a, fill: rnd(PAL.filter((x) => x !== c)) },
      ],
    };
  },
  /* ур.2 — поворот на 90° */
  rotate90: () => {
    const c = rnd(PAL);
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
    const c = rnd(PAL);
    return {
      seq: [1, 2, 3].map((n) => ({ shape: sh, fill: c, count: n })),
      correct: { shape: sh, fill: c, count: 4 },
      distractors: [
        { shape: sh, fill: c, count: 5 },
        { shape: sh, fill: c, count: 2 },
        { shape: sh, fill: rnd(PAL.filter((x) => x !== c)), count: 4 },
      ],
    };
  },
  /* ур.3 — форма и цвет меняются вместе */
  altBoth: () => {
    const [s1, s2] = pickTwo(SHAPES.slice(0, 3));
    const [c1, c2] = pickTwo(PAL);
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
    const [c1, c2] = pickTwo(PAL);
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
    const [c1, c2] = pickTwo(PAL);
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
    const [a, b, c] = shuffle(PAL);
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
};

/* последовательность сложности: по два правила на уровень, выбирается одно */
const PATTERN_PLAN = [
  { lvl: 1, from: ["altColor", "cycleShape"] },
  { lvl: 1, from: ["cycleShape", "altColor"] },
  { lvl: 2, from: ["rotate90", "countUp"] },
  { lvl: 2, from: ["countUp", "rotate90"] },
  { lvl: 3, from: ["altBoth", "rotColor"] },
  { lvl: 3, from: ["rotColor", "altBoth"] },
  { lvl: 4, from: ["shapeCount", "cycleColor3"] },
];

function buildPatterns() {
  return PATTERN_PLAN.map((step) => {
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

/* ---------- ПУЛЫ УРОВНЕЙ РОБОТА ----------
   . пусто, # стена, S старт, T цель. Робот смотрит вправо.
   4 набора по 6 уровней. Один набор выбирается случайно.
   Прогрессия одинаковая: 3 уровня без множителя, 3 с множителем. */
const LEVEL_POOLS = [
  [
    { lvl: 1, maxChips: 6, mult: false, g: ["S..T."] },
    { lvl: 1, maxChips: 7, mult: false, g: ["S...", "...T"] },
    { lvl: 2, maxChips: 8, mult: false, g: ["S.#", "..#", "..T"] },
    { lvl: 3, maxChips: 3, mult: true,  g: ["S.....T"] },
    { lvl: 3, maxChips: 4, mult: true,  g: ["S......", "......T"] },
    { lvl: 4, maxChips: 6, mult: true,  g: ["S.....", "#####.", "T....."] },
  ],
  [
    { lvl: 1, maxChips: 6, mult: false, g: ["S...T"] },
    { lvl: 1, maxChips: 7, mult: false, g: ["S..", "..T"] },
    { lvl: 2, maxChips: 9, mult: false, g: ["S..", "##.", "T.."] },
    { lvl: 3, maxChips: 3, mult: true,  g: ["S.....T"] },
    { lvl: 3, maxChips: 5, mult: true,  g: [".....S", "T....."] },
    { lvl: 4, maxChips: 6, mult: true,  g: ["S......", ".#####.", ".....T."] },
  ],
  [
    { lvl: 1, maxChips: 6, mult: false, g: ["S.T.."] },
    { lvl: 1, maxChips: 7, mult: false, g: ["S....", "T...."] },
    { lvl: 2, maxChips: 8, mult: false, g: [".#T", ".#.", "S.."] },
    { lvl: 3, maxChips: 3, mult: true,  g: ["S....T"] },
    { lvl: 3, maxChips: 4, mult: true,  g: ["S........", "........T"] },
    { lvl: 4, maxChips: 6, mult: true,  g: ["T.....", "#####.", "S....."] },
  ],
  [
    { lvl: 1, maxChips: 6, mult: false, g: ["S..T"] },
    { lvl: 1, maxChips: 7, mult: false, g: ["S....", "....T"] },
    { lvl: 2, maxChips: 8, mult: false, g: ["S#.", ".#.", "..T"] },
    { lvl: 3, maxChips: 3, mult: true,  g: ["S.......T"] },
    { lvl: 3, maxChips: 5, mult: true,  g: ["S.......", ".......T"] },
    { lvl: 4, maxChips: 6, mult: true,  g: ["S......", "######.", "T......"] },
  ],
];

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

/* ============================================================ */
export default function App() {
  const [stage, setStage] = useState("intro");
  const [data, setData] = useState({
    patterns: [], robot: [], answers: {}, selfAssess: null,
  });
  /* в боевой версии придёт из ссылки менеджера: имя, возраст, пол */
  const child = React.useMemo(() => {
    const name = "Амир", age = 10, gender = "m";
    return { name, age, gender, n: declineName(name, gender), years: yearsWord(age) };
  }, []);

  /* вариант сессии выбирается один раз: задания, уровни и вопросы
     будут разными у каждого ребёнка */
  const [ses] = useState(() => ({
    patterns: buildPatterns(),
    levels: LEVEL_POOLS[Math.floor(Math.random() * LEVEL_POOLS.length)],
    q1: Q1_POOL[Math.floor(Math.random() * Q1_POOL.length)],
    q2: Q2_POOL[Math.floor(Math.random() * Q2_POOL.length)],
  }));

  const push = (key, val) =>
    setData((d) => ({ ...d, [key]: [...d[key], val] }));
  const setAns = (k, v) =>
    setData((d) => ({ ...d, answers: { ...d.answers, [k]: v } }));

  return (
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
        @keyframes fadeUp { from { opacity:0; transform: translateY(8px);} to {opacity:1;transform:none;} }
        .fade { animation: fadeUp .32s ease both; }
        button { font-family: inherit; cursor: pointer; }
        button:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 3px; }
        .opt:hover { border-color: ${C.teal} !important; transform: translateY(-2px); }
        @media (hover: none) { .opt:hover { transform: none; } }
        @media (prefers-reduced-motion: reduce) { .fade { animation: none; } }
      `}</style>

      {stage === "intro" && <Intro child={child} onStart={() => setStage("how1")} />}

      {stage === "how1" && (
        <HowTo
          eyebrow="Блок 1 · Закономерности"
          title="Найди закономерность"
          steps={[
            "Наверху ряд фигур. Они меняются по какому-то правилу.",
            "Одна фигура спрятана — на её месте знак вопроса.",
            "Твоя задача: понять правило и выбрать снизу ту фигуру, что подходит.",
          ]}
          example="example-pattern"
          onStart={() => setStage("b1")}
        />
      )}

      {stage === "b1" && (
        <Patterns
          tasks={ses.patterns}
          onDone={(res) => { setData((d) => ({ ...d, patterns: res })); setStage("q1"); }}
        />
      )}

      {stage === "q1" && (
        <Questions
          title="Пара вопросов"
          sub="Правильных ответов нет — расскажи, как ты решал."
          items={ses.q1}
          onDone={(a) => { setData((d)=>({...d, answers:{...d.answers, ...a}})); setStage("how2"); }}
        />
      )}

      {stage === "how2" && (
        <HowTo
          eyebrow="Блок 2 · Робот"
          title="Приведи робота к цели"
          steps={[
            "Робот стоит в начале, а цель — клетка с кружком.",
            "Собери для него команды: «Вперёд», «Налево», «Направо». Робот выполнит их по порядку.",
            "Нажми «Запустить» и посмотри, дойдёт ли он. Не вышло — поправь команды и попробуй снова.",
          ]}
          example="example-robot"
          onStart={() => setStage("b2")}
        />
      )}

      {stage === "b2" && (
        <Robot
          levels={ses.levels}
          onDone={(res) => { setData((d) => ({ ...d, robot: res })); setStage("q2"); }}
        />
      )}

      {stage === "q2" && (
        <Questions
          title="И ещё два"
          sub="Тоже без правильных ответов."
          items={ses.q2}
          onDone={(a) => { setData((d)=>({...d, answers:{...d.answers, ...a}})); setStage("self"); }}
        />
      )}

      {stage === "self" && (
        <SelfAssess
          onDone={(v) => { setData((d) => ({ ...d, selfAssess: v })); setStage("result"); }}
        />
      )}

      {stage === "result" && <Result child={child} data={data} />}
    </div>
  );
}

/* ---------- общая обёртка ---------- */
/* ---------- экран-инструкция перед блоком ---------- */
function ExamplePattern() {
  /* мини-демо: круг-квадрат-круг-? → квадрат, с подсветкой ответа */
  const T = C.teal;
  const seq = [
    { shape: "circle", fill: T }, { shape: "square", fill: T },
    { shape: "circle", fill: T },
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

function ExampleRobot() {
  /* мини-демо поля 3 клетки: робот → → цель */
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", gap: 5 }}>
        <div style={{ width: 44, height: 44, borderRadius: 7, background: C.paper,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: C.amber,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: "rotate(90deg)" }}>
              <polygon points="6,1 11,10 6,7.5 1,10" fill={C.ink} />
            </svg>
          </div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 7, background: C.paper }} />
        <div style={{ width: 44, height: 44, borderRadius: 7, background: C.tealSoft,
          border: `1.5px dashed ${C.teal}`, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 9, height: 9, borderRadius: 5, background: C.teal }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: C.muted }}>команды:</span>
        <span style={{ background: C.ink, color: "#fff", borderRadius: 6,
          padding: "6px 11px", fontSize: 13 }}>Вперёд</span>
        <span style={{ background: C.ink, color: "#fff", borderRadius: 6,
          padding: "6px 11px", fontSize: 13 }}>Вперёд</span>
      </div>
      <span style={{ fontSize: 13, color: C.muted }}>два шага — и робот на цели</span>
    </div>
  );
}

function HowTo({ eyebrow, title, steps, example, onStart }) {
  return (
    <Shell max={540}>
      <div className="fade">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 27, margin: "0 0 8px" }}>
          {title}
        </h2>
        <p style={{ color: C.muted, fontSize: 14.5, margin: "0 0 22px" }}>
          Как это работает — на примере:
        </p>

        {/* демо */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`,
          borderRadius: 10, padding: "22px 18px", marginBottom: 24 }}>
          {example === "example-pattern" ? <ExamplePattern /> : <ExampleRobot />}
        </div>

        {/* шаги */}
        <ol style={{ margin: "0 0 26px", padding: 0, listStyle: "none" }}>
          {steps.map((st, i) => (
            <li key={i} style={{ display: "flex", gap: 13, marginBottom: 13,
              fontSize: 15.5, lineHeight: 1.5, alignItems: "flex-start" }}>
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

function Shell({ children, max = 640 }) {
  return (
    <div style={{ padding: "28px 18px 56px" }}>
      <div style={{ maxWidth: max, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function Progress({ value }) {
  return (
    <div style={{ height: 3, background: C.line, borderRadius: 2, overflow: "hidden" }}>
      <div
        style={{
          height: "100%", width: `${value * 100}%`, background: C.teal,
          transition: "width .4s ease",
        }}
      />
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: MONO, fontSize: 11, letterSpacing: ".12em",
        textTransform: "uppercase", color: C.muted, marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ children, onClick, kind = "primary", disabled }) {
  const base = {
    border: "none", borderRadius: 8, padding: "13px 26px",
    fontSize: 15, fontWeight: 600, letterSpacing: ".01em",
    transition: "opacity .15s, transform .1s",
    opacity: disabled ? 0.35 : 1,
  };
  const styles =
    kind === "primary"
      ? { ...base, background: C.ink, color: "#fff" }
      : { ...base, background: "transparent", color: C.teal, border: `1px solid ${C.line}` };
  return (
    <button style={styles} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/* ---------- интро ---------- */
function Intro({ child, onStart }) {
  const [ok, setOk] = useState(false);
  return (
    <Shell max={560}>
      <div className="fade">
        <div
          style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: ".16em",
            color: C.teal, marginBottom: 26,
          }}
        >
          KURSOR · ДИАГНОСТИКА СПОСОБНОСТЕЙ
        </div>

        <h1
          style={{
            fontFamily: SERIF, fontSize: 32, lineHeight: 1.22,
            fontWeight: 400, margin: "0 0 16px",
          }}
        >
          Привет! Давай проверим,<br />как ты думаешь
        </h1>

        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: C.ink2, margin: "0 0 14px" }}>
          Тебя ждут игры и головоломки. Нужно находить закономерности,
          вести робота к цели и запоминать. Это не экзамен — здесь нельзя
          «провалиться».
        </p>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: C.ink2, margin: "0 0 28px" }}>
          Просто делай как чувствуешь. Мы смотрим не на оценки, а на то,
          как именно ты решаешь задачи.
        </p>

        <div
          style={{
            background: C.card, border: `1px solid ${C.line}`,
            borderRadius: 10, padding: "16px 20px", marginBottom: 26,
          }}
        >
          {[
            ["Сколько идти", "около 12 минут"],
            ["Заданий", "два блока игр и вопросы"],
            ["Если ошибёшься", "ничего страшного, идём дальше"],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex", gap: 14, padding: "7px 0",
                fontSize: 14.5, alignItems: "baseline",
              }}
            >
              <span style={{ color: C.muted, minWidth: 130, fontSize: 13.5 }}>{k}</span>
              <span style={{ color: C.ink, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>

        <label
          style={{
            display: "flex", gap: 11, alignItems: "flex-start",
            fontSize: 13, color: C.muted, lineHeight: 1.55,
            marginBottom: 24, cursor: "pointer",
          }}
        >
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

/* ---------- блок 1: закономерности ---------- */
function Patterns({ tasks, onDone }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [res, setRes] = useState([]);
  const t0 = useRef(Date.now());

  useEffect(() => { t0.current = Date.now(); }, [i]);

  const task = tasks[i];

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    const rec = {
      lvl: task.lvl,
      correct: idx === task.ans,
      ms: Date.now() - t0.current,
    };
    const next = [...res, rec];
    setRes(next);
    setTimeout(() => {
      if (i + 1 < tasks.length) { setI(i + 1); setPicked(null); }
      else onDone(next);
    }, 620);
  };

  const cell = (spec, key, dim) => (
    <div
      key={key}
      style={{
        aspectRatio: "1", background: C.card,
        border: `1px solid ${C.line}`, borderRadius: 8,
        padding: 10, opacity: dim ? 0.5 : 1,
      }}
    >
      {spec ? (
        <Glyph {...spec} />
      ) : (
        <div
          style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontFamily: SERIF, fontSize: 30, color: C.amber,
          }}
        >
          ?
        </div>
      )}
    </div>
  );

  return (
    <Shell max={520}>
      <Progress value={i / tasks.length} />
      <div style={{ marginTop: 22 }} className="fade" key={i}>
        <Eyebrow>Блок 1 · Закономерности · {i + 1} из {tasks.length}</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 22, margin: "0 0 6px" }}>
          Какая фигура спряталась?
        </h2>
        <p style={{ color: C.muted, fontSize: 14, margin: "0 0 20px" }}>
          Пойми правило ряда и выбери подходящую фигуру внизу.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9 }}>
          {task.seq.map((s, k) => cell(s, k, false))}
        </div>

        <div
          style={{
            display: "flex", alignItems: "center", gap: 14,
            margin: "38px 0 16px",
          }}
        >
          <div style={{ flex: 1, height: 1, background: C.line }} />
          <span
            style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: ".1em",
              color: C.muted, whiteSpace: "nowrap",
            }}
          >
            ВЫБЕРИ ОТВЕТ
          </span>
          <div style={{ flex: 1, height: 1, background: C.line }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {task.opts.map((s, k) => (
            <button
              key={k}
              onClick={() => choose(k)}
              className="opt"
              style={{
                aspectRatio: "1", background: C.card, padding: 11,
                border: `2px solid ${picked === k ? C.teal : C.line}`,
                borderRadius: 10,
                boxShadow:
                  picked === k
                    ? `0 0 0 3px ${C.tealSoft}`
                    : "0 1px 2px rgba(14,42,51,.07)",
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

/* ---------- вопросы ---------- */
/* ---------- ВАРИАНТЫ ВОПРОСОВ ----------
   Формулировки разные, измеряемое — одно и то же (v совпадает). */
const Q1_POOL = [
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
];

const Q2_POOL = [
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
];

function Questions({ title, sub, items, onDone }) {
  const [a, setA] = useState({});
  const done = items.every((x) => a[x.id]);
  return (
    <Shell max={540}>
      <div className="fade">
        <Eyebrow>Между блоками</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 26, margin: "0 0 6px" }}>
          {title}
        </h2>
        <p style={{ color: C.muted, fontSize: 14.5, margin: "0 0 26px" }}>{sub}</p>

        {items.map((item) => (
          <div key={item.id} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 11 }}>{item.q}</div>
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
                    fontSize: 15, color: C.ink, transition: "all .15s",
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

/* ---------- блок 2: робот ---------- */
function Robot({ levels, onDone }) {
  const [li, setLi] = useState(0);
  const [prog, setProg] = useState([]);      // [{cmd:'F'|'L'|'R', n:1}]
  const [run, setRun] = useState(null);      // {x,y,dir}
  const [fail, setFail] = useState(false);
  const [res, setRes] = useState([]);
  const attempts = useRef(0);
  const usedMult = useRef(false);
  const multAtAttempt = useRef(null); // на какой попытке впервые применён множитель
  const t0 = useRef(Date.now());

  const L = levels[li];
  const G = parseGrid(L.g);

  useEffect(() => {
    attempts.current = 0; usedMult.current = false;
    multAtAttempt.current = null; t0.current = Date.now();
  }, [li]);

  const add = (cmd) => {
    if (run) return;
    if (prog.length >= L.maxChips) return;
    setProg([...prog, { cmd, n: 1 }]);
    setFail(false);
  };

  const bump = (idx) => {
    if (run || !L.mult) return;
    const p = [...prog];
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

  const execute = () => {
    if (!prog.length || run) return;
    attempts.current += 1;
    const steps = [];
    let st = { ...G.start, dir: 1 };
    steps.push({ ...st });
    let crashed = false;
    let reached = st.x === G.target.x && st.y === G.target.y;
    let stop = reached;

    for (const item of prog) {
      if (stop) break;
      for (let r = 0; r < item.n; r++) {
        if (item.cmd === "L") st.dir = (st.dir + 3) % 4;
        else if (item.cmd === "R") st.dir = (st.dir + 1) % 4;
        else {
          const dx = [0, 1, 0, -1][st.dir], dy = [-1, 0, 1, 0][st.dir];
          const nx = st.x + dx, ny = st.y + dy;
          if (nx < 0 || ny < 0 || nx >= G.w || ny >= G.h || G.cells[ny][nx] === "#") {
            crashed = true;
          } else { st.x = nx; st.y = ny; }
        }
        steps.push({ ...st });
        if (crashed) { stop = true; break; }
        // дошёл до цели — останавливаемся, остальные команды не важны
        if (st.x === G.target.x && st.y === G.target.y) {
          reached = true; stop = true; break;
        }
      }
    }

    let k = 0;
    setRun(steps[0]);
    const iv = setInterval(() => {
      k += 1;
      if (k < steps.length) setRun(steps[k]);
      else {
        clearInterval(iv);
        const win = reached;
        setTimeout(() => {
          if (win) {
            const rec = {
              lvl: L.lvl, solved: true, attempts: attempts.current,
              usedMult: usedMult.current, multAvailable: L.mult,
              selfDiscovered: multAtAttempt.current === 0,
              ms: Date.now() - t0.current,
            };
            const next = [...res, rec];
            setRes(next);
            if (li + 1 < levels.length) {
              setLi(li + 1); setProg([]); setRun(null); setFail(false);
            } else onDone(next);
          } else {
            setRun(null); setFail(true);
            if (attempts.current >= 4) {
              const rec = {
                lvl: L.lvl, solved: false, attempts: attempts.current,
                usedMult: usedMult.current, multAvailable: L.mult,
                selfDiscovered: multAtAttempt.current === 0,
                ms: Date.now() - t0.current,
              };
              const next = [...res, rec];
              setRes(next);
              if (li + 1 < levels.length) {
                setLi(li + 1); setProg([]); setFail(false);
              } else onDone(next);
            }
          }
        }, 340);
      }
    }, 340);
  };

  const pos = run || { ...G.start, dir: 1 };
  const cellPx = Math.min(56, Math.floor(300 / G.w));

  const CMD = { F: "Вперёд", L: "Налево", R: "Направо" };

  return (
    <Shell max={520}>
      <Progress value={li / levels.length} />
      <div style={{ marginTop: 22 }} className="fade" key={li}>
        <Eyebrow>Блок 2 · Робот · {li + 1} из {levels.length}</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 22, margin: "0 0 6px" }}>
          Приведи робота к кружку
        </h2>
        <p style={{ color: C.muted, fontSize: 14, margin: "0 0 20px" }}>
          {L.mult
            ? `Команд мало — всего ${L.maxChips}, а идти далеко. Нажимай на жёлтый значок ×1 у команды «Вперёд» — цифра вырастет, и робот повторит шаг столько раз. Так один «Вперёд ×5» заменяет пять команд.`
            : `Нажимай на кнопки внизу — команды встанут по очереди. Их можно поставить до ${L.maxChips}.`}
        </p>

        {/* поле */}
        <div
          style={{
            background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
            padding: 16, display: "flex", justifyContent: "center", marginBottom: 18,
          }}
        >
          <div
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
                    style={{
                      width: cellPx, height: cellPx, borderRadius: 6,
                      background:
                        ch === "#" ? C.ink : isT ? C.tealSoft : C.paper,
                      border: isT ? `1.5px dashed ${C.teal}` : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    {isT && !isRobot && (
                      <div style={{ width: 9, height: 9, borderRadius: 5, background: C.teal }} />
                    )}
                    {isRobot && (
                      <div
                        style={{
                          width: cellPx - 14, height: cellPx - 14, borderRadius: 6,
                          background: C.amber, display: "flex",
                          alignItems: "center", justifyContent: "center",
                          transform: `rotate(${pos.dir * 90}deg)`,
                          transition: "transform .2s",
                        }}
                      >
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

        {/* программа */}
        <div
          style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "baseline", marginBottom: 6,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: ".08em" }}>
            ПРОГРАММА
          </span>
          <span
            style={{
              fontFamily: MONO, fontSize: 12,
              color: prog.length >= L.maxChips ? C.amber : C.muted,
            }}
          >
            {prog.length} / {L.maxChips}
          </span>
        </div>
        <div
          style={{
            minHeight: 52, background: C.card, border: `1px dashed ${C.line}`,
            borderRadius: 8, padding: 9, marginBottom: 12,
            display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center",
          }}
        >
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
                style={{
                  background: C.ink, color: "#fff", border: "none",
                  borderRadius: 6, padding: adj ? "6px 6px 6px 12px" : "8px 12px",
                  fontSize: 13.5, fontWeight: 500,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                <span>{CMD[p.cmd]}</span>
                {adj && (
                  <span
                    style={{
                      fontFamily: MONO, fontSize: 13, fontWeight: 700,
                      color: C.ink, background: C.amber,
                      borderRadius: 4, padding: "3px 7px",
                      display: "inline-flex", alignItems: "center", gap: 3,
                    }}
                  >
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

        {/* кнопки команд */}
        <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
          {["F", "L", "R"].map((c) => (
            <button
              key={c}
              onClick={() => add(c)}
              style={{
                flex: "1 1 90px", background: C.card, border: `1.5px solid ${C.line}`,
                borderRadius: 8, padding: "12px 8px", fontSize: 14, color: C.ink,
                opacity: prog.length >= L.maxChips ? 0.4 : 1,
              }}
            >
              {CMD[c]}
            </button>
          ))}
        </div>

        {fail && (
          <div
            style={{
              fontSize: 14, color: C.ink2, background: C.tealSoft,
              padding: "11px 14px", borderRadius: 7, marginBottom: 13,
            }}
          >
            {L.mult
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

/* ---------- самооценка ---------- */
function SelfAssess({ onDone }) {
  const [v, setV] = useState(null);
  return (
    <Shell max={540}>
      <div className="fade">
        <Eyebrow>Последний вопрос</Eyebrow>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 26, margin: "0 0 8px" }}>
          Как думаешь, сколько ты решил правильно?
        </h2>
        <p style={{ color: C.muted, fontSize: 14.5, margin: "0 0 24px" }}>
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
                fontSize: 15, color: C.ink,
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

/* ---------- расчёт ---------- */
function compute(data, n) {
  const P = data.patterns, R = data.robot, A = data.answers;
  const pCorrect = P.filter((x) => x.correct).length;
  const pRate = P.length ? pCorrect / P.length : 0;
  const pMaxLvl = Math.max(0, ...P.filter((x) => x.correct).map((x) => x.lvl));
  const avgMs = P.length ? P.reduce((s, x) => s + x.ms, 0) / P.length : 9000;

  const rSolved = R.filter((x) => x.solved).length;
  const rRate = R.length ? rSolved / R.length : 0;
  const rMaxLvl = Math.max(0, ...R.filter((x) => x.solved).map((x) => x.lvl));
  const totalAttempts = R.reduce((s, x) => s + x.attempts, 0);
  const retried = R.filter((x) => x.attempts > 1);
  const persisted = retried.filter((x) => x.solved).length;
  const multChance = R.filter((x) => x.multAvailable);
  const multUsed = multChance.filter((x) => x.usedMult).length;
  const multSelf = multChance.filter((x) => x.selfDiscovered).length;

  /* мягкое сжатие у верхнего края: сильные результаты не слипаются в 97 */
  const clamp = (v) => {
    let x = Math.max(6, v);
    if (x > 78) x = 78 + (x - 78) * 0.42;   // выше 78 растёт медленнее
    return Math.round(Math.max(6, Math.min(94, x)));
  };

  const s = {};
  s["ДКМ-01"] = clamp(rRate * 62 + rMaxLvl * 9 + (multUsed ? 12 : 0));
  s["ИНД-02"] = clamp(pRate * 66 + pMaxLvl * 8);
  s["ТФР-06"] = clamp(
    retried.length ? (persisted / retried.length) * 74 + 18 : 58 + rRate * 20
  );
  s["КБГ-08"] = clamp(avgMs < 4000 ? 88 : avgMs < 7000 ? 72 : avgMs < 11000 ? 56 : 40);
  s["БСТ-09"] = clamp(
    (pRate * 55) + (avgMs > 5000 && pRate > 0.6 ? 32 : 14)
  );
  const lateP = P.slice(-3).filter((x) => x.correct).length / 3;
  s["АНН-10"] = clamp(lateP * 60 + rMaxLvl * 8 + 14);
  s["СТП-11"] = clamp(
    (A.plan === "global" ? 82 : A.plan === "step" ? 64 : 44) +
    (A.strategy === "global" ? 10 : 0)
  );
  const claimed = { high: 0.9, mid: 0.7, half: 0.5, low: 0.3 }[data.selfAssess] ?? 0.5;
  const real = (pRate + rRate) / 2;
  s["МКР-13"] = clamp(92 - Math.abs(claimed - real) * 130);

  const top = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 3);

  /* наблюдения — только из фактов */
  const N = n?.nom || "Ребёнок";
  /* согласование по роду: v("сократил") → «сократил» или «сократила» */
  const f = n?.g === "f";
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
      `Не ${v("отступил")} после неудачи: ${v("возвращался", "возвращалась")} к задаче и ${v("доводил")} её до конца — ${persisted} раз${persisted === 1 ? "" : "а"} из ${retried.length}.`
    );
  if (pCorrect >= 6)
    notes.push(`В блоке на закономерности почти не ${v("ошибался", "ошибалась")}.`);
  if (avgMs < 4500 && pRate >= 0.7)
    notes.push(
      `${N} решает быстро и при этом точно — редкое сочетание для этого возраста.`
    );
  if (A.error === "debug")
    notes.push("При ошибке ищет конкретное место сбоя, а не переделывает всё заново.");
  if (rMaxLvl >= 3)
    notes.push(`${v("Дошёл", "Дошла")} до заданий повышенной сложности и ${v("справился", "справилась")} с ними.`);
  if (!notes.length)
    notes.push(`${N} ${v("прошёл", "прошла")} диагностику полностью, все задания выполнены до конца.`);

  /* направление — по тому, какая пара шкал сильнее */
  const dirScores = {
    "Разработка игр и интерактивных сред": s["ДКМ-01"] * 1.0 + s["АНН-10"] * 0.6,
    "Веб-разработка и интерфейсы": s["ДКМ-01"] * 0.7 + s["БСТ-09"] * 0.9,
    "Логика и анализ данных": s["ИНД-02"] * 1.0 + s["МКР-13"] * 0.6,
    "Алгоритмы и робототехника": s["ДКМ-01"] * 0.8 + s["ТФР-06"] * 0.8,
    "Цифровая графика и 3D": s["КБГ-08"] * 0.7 + s["ИНД-02"] * 0.7,
  };
  const dir = Object.entries(dirScores).sort((a, b) => b[1] - a[1])[0][0];

  return { scores: s, top, notes: notes.slice(0, 3), dir };
}

/* ---------- результат ---------- */
function Result({ child, data }) {
  const { top, notes, dir } = compute(data, child.n);
  const meta = (code) => SCALES.find((x) => x.code === code);

  return (
    <Shell max={620}>
      <div className="fade">
        {/* шапка отчёта */}
        <div
          style={{
            borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 26,
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
            gap: 16, flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: MONO, fontSize: 10.5, letterSpacing: ".16em", color: C.teal,
              }}
            >
              KURSOR · ЗАКЛЮЧЕНИЕ
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 27, marginTop: 6 }}>
              {child.n.nom}, {child.age} {child.years}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted, textAlign: "right" }}>
            22.07.2026<br />
            <span style={{ color: C.teal }}>14 параметров</span>
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
              <div
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", gap: 12, marginBottom: 5,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted, letterSpacing: ".08em" }}>
                  {code}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 19, color: C.ink, fontWeight: 600 }}>
                  {val}
                </div>
              </div>
              <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.3 }}>{m.name}</div>
              <div
                style={{
                  height: 4, background: C.line, borderRadius: 2,
                  marginTop: 11, overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%", width: `${val}%`,
                    background: idx === 0 ? C.amber : C.teal,
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* наблюдения */}
        <div style={{ marginTop: 30 }}>
          <Eyebrow>Что зафиксировала система</Eyebrow>
          <div
            style={{
              background: C.card, border: `1px solid ${C.line}`,
              borderRadius: 8, padding: "6px 18px",
            }}
          >
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
          <div
            style={{
              background: C.card, border: `1px solid ${C.line}`,
              borderRadius: 8, padding: 18, position: "relative", overflow: "hidden",
            }}
          >
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

            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(255,255,255,.55)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                textAlign: "center", padding: 22,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 10 }}>
                <rect x="4" y="10" width="16" height="11" rx="2.5" fill={C.ink} />
                <path d="M8 10V7a4 4 0 118 0v3" stroke={C.ink} strokeWidth="2" fill="none" />
              </svg>
              <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 4 }}>
                Ещё 11 параметров измерено
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, maxWidth: 330 }}>
                Полный профиль, расшифровку каждого параметра и рекомендации
                специалист разбирает лично
              </div>
            </div>
          </div>
        </div>

        {/* направление — закрыто до встречи */}
        <div
          style={{
            marginTop: 22, background: C.ink, borderRadius: 8,
            padding: "22px 24px", color: "#fff", position: "relative",
          }}
        >
          <div
            style={{
              fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em",
              color: C.amber, marginBottom: 10,
            }}
          >
            РЕКОМЕНДОВАННОЕ НАПРАВЛЕНИЕ
          </div>
          <div
            style={{
              fontFamily: SERIF, fontSize: 21, lineHeight: 1.3,
              filter: "blur(7px)", opacity: 0.45, userSelect: "none",
            }}
          >
            {dir}
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 9,
              marginTop: 14, paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,.14)",
            }}
          >
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
        <div
          style={{
            marginTop: 22, border: `1px solid ${C.line}`, background: C.card,
            borderRadius: 8, padding: "22px 22px 24px",
          }}
        >
          <div style={{ fontFamily: SERIF, fontSize: 20, marginBottom: 9 }}>
            Разбор результатов
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: C.ink2, margin: "0 0 18px" }}>
            Специалист разберёт профиль {child.n.gen} лично: что стоит за каждым
            параметром, где сильные стороны и что с ними делать дальше. Разбор
            занимает около 15 минут и проводится индивидуально.
          </p>
          <div
            style={{
              display: "flex", gap: 12, alignItems: "baseline",
              fontSize: 15, marginBottom: 20, flexWrap: "wrap",
            }}
          >
            <span style={{ color: C.muted, fontSize: 13 }}>Ваша встреча</span>
            <span style={{ fontWeight: 600 }}>{(typeof window !== "undefined" && window.KX && window.KX.mk) ? window.KX.mk : "уточнит менеджер"}</span>
            <span style={{ color: C.muted, fontSize: 13.5 }}>· ул. Жумабека Ташенова, 8</span>
          </div>
          <Btn onClick={() => {}}>Подтвердить, что придём</Btn>
        </div>

        <div
          style={{
            marginTop: 26, fontSize: 12, color: C.muted, lineHeight: 1.55,
            fontFamily: MONO,
          }}
        >
          Диагностика оценивает познавательные процессы и не является
          психологическим или медицинским заключением.
        </div>
      </div>
    </Shell>
  );
}
