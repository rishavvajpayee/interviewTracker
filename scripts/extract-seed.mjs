import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const h = fs.readFileSync(path.join(root, "interview-tracker.html"), "utf8");

function extractAfter(marker) {
  const i = h.indexOf(marker);
  if (i < 0) throw new Error(`marker not found: ${marker}`);
  let j = i + marker.length;
  while (h[j] === " " || h[j] === "\n") j++;
  if (h[j] !== "[") throw new Error(`expected [ got ${JSON.stringify(h[j])}`);
  let depth = 0;
  const start = j;
  let inStr = false;
  let esc = false;
  for (; j < h.length; j++) {
    const c = h[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return h.slice(start, j + 1);
    }
  }
  throw new Error("unclosed array");
}

const cand = JSON.parse(extractAfter("window._candidates = "));
const off = JSON.parse(extractAfter("var _offers = "));
const lib = path.join(root, "lib");
fs.mkdirSync(lib, { recursive: true });
fs.writeFileSync(path.join(lib, "seed-candidates.json"), JSON.stringify(cand));
fs.writeFileSync(path.join(lib, "seed-offers.json"), JSON.stringify(off));
console.log("wrote", cand.length, "candidates,", off.length, "offers");
