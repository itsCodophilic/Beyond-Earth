#!/usr/bin/env node
/*
 * Guards against the one mistake that has broken this codebase three times.
 *
 * Shader source is written inline as `/* glsl *\/` tagged template literals. A
 * backtick anywhere inside one -- and the natural place to put one is around an
 * identifier in a prose comment, `profile.w`, `coverage`, `shape` -- ends the
 * JavaScript string right there. What follows is parsed as code, and the error
 * you get names a GLSL identifier at a line number inside a comment, which
 * looks like a shader compiler complaining and is nothing of the kind.
 *
 * `node --check` does not catch it in every arrangement, and the failure only
 * shows up when the module is actually loaded, so this runs the check directly.
 *
 *   node scripts/check-glsl-literals.mjs src/js/**\/*.js
 *   node scripts/check-glsl-literals.mjs            # defaults to src/js
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OPENER = /\/\* glsl \*\/`/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".js")) out.push(path);
  }
  return out;
}

const targets = process.argv.length > 2 ? process.argv.slice(2) : walk("src/js");
let bad = 0;

for (const file of targets) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(OPENER)) {
    const close = source.indexOf("`", match.index + match[0].length);
    const line = source.slice(0, close < 0 ? match.index : close).split("\n").length;
    if (close < 0) {
      console.error(`${file}:${line}  unterminated /* glsl */ literal`);
      bad += 1;
      continue;
    }
    // A real terminator is followed by the end of an argument, a statement, or
    // a newline. Anything else means the literal ended early, inside the shader.
    const after = source.slice(close + 1, close + 2);
    if (after !== "," && after !== ";" && after !== "\n" && after !== ")") {
      const context = source.slice(Math.max(0, close - 70), close + 12).replace(/\n/g, " / ");
      console.error(`${file}:${line}  stray backtick inside a shader literal\n    …${context}…`);
      bad += 1;
    }
  }
}

if (bad) {
  console.error(`\n${bad} stray backtick${bad === 1 ? "" : "s"} found.`);
  process.exit(1);
}
console.log(`${targets.length} files checked, shader literals clean.`);
