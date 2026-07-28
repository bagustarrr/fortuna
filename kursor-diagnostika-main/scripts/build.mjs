/* Собирает самодостаточный index.html из diagnostika_kursor.jsx.
   React и код теста вшиваются внутрь — файл можно перетащить на Netlify.
   Запуск: npm run build */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(root, ".build");
fs.mkdirSync(tmp, { recursive: true });

const entry = path.join(tmp, "entry.jsx");
fs.writeFileSync(entry, `
import React from "react";
import { createRoot } from "react-dom/client";
import App from ${JSON.stringify(path.join(root, "diagnostika_kursor.jsx"))};
function __mount(){ createRoot(document.getElementById("root")).render(React.createElement(App)); }
if (window.KX && !window.KX.ready) document.addEventListener("kx:ready", __mount, { once: true });
else __mount();
`);

const out = path.join(tmp, "bundle.js");
await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: out,
  logLevel: "warning",
});

const bundle = fs.readFileSync(out, "utf8");
const tpl = fs.readFileSync(path.join(root, "scripts", "template.html"), "utf8");
if (!tpl.includes("/*BUNDLE*/")) throw new Error("в шаблоне нет метки /*BUNDLE*/");
if (bundle.includes("</script")) throw new Error("бандл содержит </script — нужно экранирование");

const html = tpl.replace("/*BUNDLE*/", bundle);
fs.writeFileSync(path.join(root, "index.html"), html);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`index.html собран · бандл ${kb(bundle)} КБ · всего ${kb(html)} КБ`);

/* самопроверка: собранный файл должен реально запускаться */
const { JSDOM } = await import("jsdom");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
await new Promise((r) => setTimeout(r, 400));
const text = dom.window.document.body.textContent || "";
const bootLeft = !!dom.window.document.getElementById("boot");
dom.window.close();
if (!text.includes("KURSOR · ДИАГНОСТИКА СПОСОБНОСТЕЙ"))
  throw new Error("собранный index.html не отрисовал интро");
if (bootLeft) throw new Error("заглушка #boot осталась на экране");
console.log("проверка: интро отрисовалось, заглушка снята");
