import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "generated-test-evidence.json");

function digest(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function seed(fixture) {
  return JSON.parse(
    fs.readFileSync(path.join(root, fixture, "seed.json"), "utf8"),
  );
}

const cases = [
  {
    fixture: "broken-authorization",
    name: "cross-tenant invoice access fails closed",
    source: `
import assert from "node:assert/strict";
import { canReadInvoice } from "./system.mjs";
assert.strictEqual(
  canReadInvoice(
    { authenticated: true, tenantId: "tenant-a" },
    { tenantId: "tenant-b" },
  ),
  false,
);
`,
  },
  {
    fixture: "cross-tenant-data",
    name: "document listing preserves tenant isolation",
    source: `
import assert from "node:assert/strict";
import { listDocuments } from "./system.mjs";
const documents = [
  { tenantId: "tenant-a", id: "a" },
  { tenantId: "tenant-b", id: "b" },
];
assert.deepStrictEqual(
  listDocuments({ tenantId: "tenant-a" }, documents),
  [documents[0]],
);
`,
  },
  {
    fixture: "duplicate-side-effect",
    name: "duplicate delivery creates one charge",
    source: `
import assert from "node:assert/strict";
import { processPayment } from "./system.mjs";
let charges = 0;
const provider = { charge() { charges += 1; } };
const message = { id: "message-1", customerId: "customer", amount: 100 };
await processPayment(message, provider);
await processPayment(message, provider);
assert.strictEqual(charges, 1);
`,
  },
  {
    fixture: "retry-amplification",
    name: "one call uses one bounded retry budget",
    source: `
import assert from "node:assert/strict";
import { callWithAmplifiedRetries } from "./system.mjs";
let attempts = 0;
await assert.rejects(() => callWithAmplifiedRetries(async () => {
  attempts += 1;
  throw new Error("unavailable");
}));
assert.ok(attempts <= 3, "one logical call exceeded the declared retry budget");
`,
  },
  {
    fixture: "high-cardinality-telemetry",
    name: "metric attributes exclude user identifiers",
    source: `
import assert from "node:assert/strict";
import { requestAttributes } from "./system.mjs";
const attributes = requestAttributes({ method: "GET", userId: "user-1" });
assert.strictEqual(Object.hasOwn(attributes, "user.id"), false);
`,
  },
  {
    fixture: "unsafe-migration",
    name: "compatibility window keeps the old column",
    source: `
import assert from "node:assert/strict";
import fs from "node:fs";
const migration = fs.readFileSync("./migration.sql", "utf8");
assert.doesNotMatch(migration, /DROP\\s+COLUMN/i);
`,
  },
  {
    fixture: "kev-dependency",
    name: "known-exploited dependency is not pinned",
    source: `
import assert from "node:assert/strict";
import fs from "node:fs";
const pom = fs.readFileSync("./pom.xml", "utf8");
assert.doesNotMatch(
  pom,
  /<artifactId>log4j-core<\\/artifactId>[\\s\\S]*?<version>2[.]14[.]1<\\/version>/,
);
`,
  },
  {
    fixture: "distributed-failure-recovery",
    name: "duplicate order delivery has one durable effect",
    source: `
import assert from "node:assert/strict";
import { processOrder } from "./system.mjs";
const effects = { reserves: 0, charges: 0 };
const gateway = {
  async reserve() { effects.reserves += 1; },
  async charge() { effects.charges += 1; },
};
const message = { orderId: "order-1", amount: 100 };
await processOrder(message, gateway);
await processOrder(message, gateway);
assert.deepStrictEqual(effects, { reserves: 1, charges: 1 });
`,
  },
  {
    fixture: "distributed-failure-recovery",
    name: "delayed event cannot replace newer state",
    source: `
import assert from "node:assert/strict";
import { applyStatus } from "./system.mjs";
const order = { status: "created", sequence: 0 };
applyStatus(order, { status: "paid", sequence: 2 });
applyStatus(order, { status: "authorized", sequence: 1 });
assert.deepStrictEqual(order, { status: "paid", sequence: 2 });
`,
  },
  {
    fixture: "distributed-failure-recovery",
    name: "partial completion resumes without repeating reservation",
    source: `
import assert from "node:assert/strict";
import { processOrder } from "./system.mjs";
let reserves = 0;
let charges = 0;
const gateway = {
  async reserve() { reserves += 1; },
  async charge() {
    charges += 1;
    if (charges === 1) throw new Error("charge unavailable");
  },
};
const message = { orderId: "order-1", amount: 100 };
await assert.rejects(() => processOrder(message, gateway));
await processOrder(message, gateway);
assert.strictEqual(reserves, 1);
`,
  },
  {
    fixture: "distributed-failure-recovery",
    name: "lost response recovers the completed outcome",
    source: `
import assert from "node:assert/strict";
import { processOrder } from "./system.mjs";
let charges = 0;
const gateway = {
  async reserve() {},
  async charge() {
    charges += 1;
    if (charges === 1) throw new Error("response lost after completion");
  },
};
const message = { orderId: "order-1", amount: 100 };
await assert.rejects(() => processOrder(message, gateway));
await processOrder(message, gateway);
assert.strictEqual(charges, 1);
`,
  },
];

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-generated-"));
const temporaryPaths = new Set([temporary, fs.realpathSync(temporary)]);
const results = [];
try {
  for (const [index, testCase] of cases.entries()) {
    const fixtureRoot = path.join(root, testCase.fixture);
    const caseRoot = path.join(temporary, `case-${index + 1}`);
    fs.mkdirSync(caseRoot, { recursive: true });
    for (const entry of fs.readdirSync(fixtureRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name !== "seed.json") {
        fs.copyFileSync(
          path.join(fixtureRoot, entry.name),
          path.join(caseRoot, entry.name),
        );
      }
    }
    const generatedFile = path.join(caseRoot, "generated-check.mjs");
    fs.writeFileSync(generatedFile, testCase.source.trimStart());
    const execution = spawnSync(process.execPath, ["generated-check.mjs"], {
      cwd: caseRoot,
      encoding: "utf8",
    });
    const contract = seed(testCase.fixture);
    let normalizedOutput = `${execution.stdout || ""}${execution.stderr || ""}`;
    for (const temporaryPath of temporaryPaths) {
      normalizedOutput = normalizedOutput.replaceAll(temporaryPath, "<TEMP>");
    }
    results.push({
      seed_id: contract.id,
      fixture: testCase.fixture,
      name: testCase.name,
      generated_test_digest: digest(testCase.source.trimStart()),
      exit_code: execution.status,
      detected_seeded_defect: execution.status !== 0,
      output_digest: digest(normalizedOutput),
    });
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

const missed = results.filter((result) => !result.detected_seeded_defect);
const evidence = {
  schema: 1,
  kind: "generated-test-seed-evidence",
  evidence_class: "observed",
  generated_from: "published seed contracts",
  case_count: results.length,
  seed_count: new Set(results.map((result) => result.seed_id)).size,
  results,
  missed,
  decision: missed.length ? "missed-seeded-defect" : "all-seeded-defects-detected",
  limitations: [
    "The generator contains fixture-class adapters and is not a general test generator.",
    "A failing expected-behavior check detects a contract violation but does not identify the complete fix.",
    "Published seed contracts can make this fixture easier than an unknown production defect.",
  ],
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (missed.length) process.exitCode = 2;
