/* Собирает diagnostika_kursor.jsx в модуль, который можно импортировать
   из node (react остаётся внешним). Используется validate.mjs и smoke.mjs. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function load() {
  const tmp = path.join(root, ".build");
  fs.mkdirSync(tmp, { recursive: true });
  const out = path.join(tmp, "app.mjs");
  await build({
    entryPoints: [path.join(root, "diagnostika_kursor.jsx")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: ["node18"],
    external: ["react", "react-dom", "react-dom/*"],
    loader: { ".jsx": "jsx" },
    define: { "process.env.NODE_ENV": '"production"' },
    outfile: out,
    logLevel: "warning",
  });
  return import(pathToFileURL(out).href + "?t=" + Date.now());
}
