import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";
import { fuzz } from "../fuzz/coverage-guided/target.mjs";
import {
  corpusLimits,
  mergeCorpus,
  readCorpus,
  replaceCorpus,
} from "../scripts/lib/coverage-guided-corpus.mjs";
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
assert.match(workflow, /actions\/cache\/restore@[a-f0-9]{40}/);
assert.match(workflow, /actions\/cache\/save@[a-f0-9]{40}/);
assert.match(
  workflow,
  /if: success\(\) && github\.ref == 'refs\/heads\/main'/,
);
assert.match(
  workflow,
  /--persistent-corpus \.rivet\/persistent-coverage-guided-corpus/,
);
assert.match(workflow, /scripts\/lib\/coverage-guided-corpus\.mjs/);
assert.match(workflow, /skills\/rivet\/scripts\/lib\/fuzz\.mjs/);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-corpus-"));
try {
  const source = path.join(temporary, "source");
  const destination = path.join(temporary, "destination");
  const replacement = path.join(temporary, "replacement");
  fs.mkdirSync(source);
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(source, "one"), "first");
  fs.writeFileSync(path.join(source, "duplicate"), "first");
  fs.writeFileSync(path.join(source, "two"), "second");
  fs.writeFileSync(path.join(destination, "seed"), "first");

  assert.deepStrictEqual(mergeCorpus(source, destination), {
    added: 1,
    files: 2,
  });
  assert.strictEqual(readCorpus(destination).length, 2);
  assert.deepStrictEqual(replaceCorpus(destination, replacement), { files: 2 });
  assert.strictEqual(readCorpus(replacement).length, 2);

  fs.writeFileSync(
    path.join(source, "oversized"),
    Buffer.alloc(corpusLimits.fileBytes + 1),
  );
  assert.throws(() => readCorpus(source), /exceeds the 65536-byte limit/);
  fs.rmSync(path.join(source, "oversized"));

  const outside = path.join(temporary, "outside");
  fs.writeFileSync(outside, "outside");
  fs.symlinkSync(outside, path.join(source, "link"));
  assert.throws(() => readCorpus(source), /only regular files/);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log("Coverage-guided fuzzing tests passed.");
