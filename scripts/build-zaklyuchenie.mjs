// Сборка страницы «Персональное заключение» в самодостаточный HTML.
// Источник:  platforma_zaklyuchenie.jsx  (React, редактируемый)
// Результат:  zaklyuchenie/index.html    (React зашит внутрь, грузит /assets/kursor.js)
//
// Пересобрать:  npm run build:zaklyuchenie
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "fs";

const SRC = "platforma_zaklyuchenie.jsx";
const OUT_DIR = "zaklyuchenie";
const OUT = `${OUT_DIR}/index.html`;

// точка входа: монтируем App в #root
const ENTRY = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../${SRC}";
createRoot(document.getElementById("root")).render(React.createElement(App));
`;

const result = await build({
  stdin: {
    contents: ENTRY,
    resolveDir: "scripts",
    loader: "jsx",
    sourcefile: "_entry.jsx",
  },
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2018"],
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
  legalComments: "none",
});

const js = result.outputFiles[0].text;

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#17130f">
<meta name="robots" content="noindex, nofollow">
<title>Персональное заключение — KURSOR</title>
<link rel="stylesheet" href="/assets/fonts/manrope.css">
<style>html,body{margin:0;padding:0;background:#17130f}#root{min-height:100vh}</style>
</head>
<body>
<div id="root"></div>
<script src="/assets/kursor.js"></script>
<script>${js}</script>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html);
console.log(`built ${OUT} — ${(html.length / 1024) | 0} KB`);
