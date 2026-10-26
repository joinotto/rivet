import assert from "assert";
import fs from "fs";
import path from "path";
import { fuzz } from "../fuzz/coverage-guided/target.mjs";
import {
  normalizeSarifDocument,
  normalizeSbomDocument,
  normalizeTrivyDocument,
} from "../skills/rivet/scripts/lib/security-evidence.mjs";

const corpusRoot = "fuzz/coverage-guided/corpus";
for (const file of fs.readdirSync(corpusRoot)) {
  const input = fs.readFileSync(path.join(corpusRoot, file));
  assert.doesNotThrow(() => fuzz(input));
}
assert.doesNotThrow(() => fuzz(Buffer.from("{invalid")));

assert.strictEqual(
  normalizeSarifDocument({ version: "2.1.0", runs: [] }).format,
  "sarif-2.1.0",
);
assert.strictEqual(
  normalizeTrivyDocument({ Results: [] }).format,
  "trivy-json",
);
assert.strictEqual(
  normalizeSbomDocument(
    { bomFormat: "CycloneDX", specVersion: "1.6", components: [{}] },
    "revision",
  ).format,
  "CycloneDX",
);

const packageDocument = JSON.parse(
  fs.readFileSync("fuzz/coverage-guided/package.json", "utf8"),
);
assert.deepStrictEqual(packageDocument.engines, { node: ">=22" });
assert.strictEqual(
  packageDocument.devDependencies["@jazzer.js/core"],
  "4.0.0",
);
const lock = JSON.parse(
  fs.readFileSync("fuzz/coverage-guided/package-lock.json", "utf8"),
);
assert.strictEqual(
  lock.packages[""].devDependencies["@jazzer.js/core"],
  "4.0.0",
);
assert.match(
  lock.packages["node_modules/@jazzer.js/core"].integrity,
  /^sha512-/,
);

const workflow = fs.readFileSync(
  ".github/workflows/coverage-guided-fuzz.yml",
  "utf8",
);
assert.match(workflow, /permissions:\n  contents: read/);
assert.match(workflow, /node-version: "22"/);
assert.match(workflow, /npm ci --prefix fuzz\/coverage-guided/);
assert.match(workflow, /--executions 10000/);
assert.match(workflow, /retention-days: 14/);
assert.match(workflow, /persist-credentials: false/);
assert.doesNotMatch(workflow, /pull_request_target/);
assert.doesNotMatch(workflow, /uses:\s+[^@\n]+@(main|master|v\d+)\s*$/m);

console.log("Coverage-guided fuzzing tests passed.");
