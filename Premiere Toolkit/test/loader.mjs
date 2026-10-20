/* Carrega src/00-classify.js (estilo namespace, sem export) num sandbox. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "plugin", "src", "00-classify.js"), "utf8");
const fn = new Function("var PT = {};" + code + "; return PT.classify;");
export const classify = fn();
