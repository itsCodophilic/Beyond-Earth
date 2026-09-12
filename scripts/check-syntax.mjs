/**
 * Parses every source file, properly.
 *
 * There was already a syntax gate here -- `node --check` on each file -- and
 * it was worthless. Without `"type": "module"` in package.json, node treats a
 * `.js` file as CommonJS; faced with `import` statements it quietly gives up
 * rather than failing, and `--check` exits 0. Verified directly: a file with
 * `function broken( {` appended passed.
 *
 * That blind spot shipped a stray brace to the browser, which is the only
 * reason it was found. `--input-type=module` forces the module parser, and
 * the same deliberately-broken file then fails as it should.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";

const files = globSync("src/**/*.js").sort();
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ["--input-type=module", "--check"], {
      input: readFileSync(file),
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    failed += 1;
    const detail = String(error.stderr || error.message)
      .split("\n").slice(0, 4).join("\n");
    console.error(`FAIL ${file}\n${detail}`);
  }
}

if (failed) {
  console.error(`${files.length} files checked, ${failed} failed to parse.`);
  process.exit(1);
}
console.log(`${files.length} files checked, all parse as modules.`);
