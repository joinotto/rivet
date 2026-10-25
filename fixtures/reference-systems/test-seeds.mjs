import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { canReadInvoice } from "./broken-authorization/system.mjs";
import { listDocuments } from "./cross-tenant-data/system.mjs";
import { processPayment } from "./duplicate-side-effect/system.mjs";
import { requestAttributes } from "./high-cardinality-telemetry/system.mjs";
import { callWithAmplifiedRetries } from "./retry-amplification/system.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

assert.strictEqual(
  canReadInvoice(
    { authenticated: true, tenantId: "tenant-a" },
    { tenantId: "tenant-b" },
  ),
  true,
  "The broken authorization seed was removed.",
);

let charges = 0;
const provider = {
  charge() {
    charges += 1;
    return { id: `charge-${charges}` };
  },
};
const message = { customerId: "customer", amount: 100, id: "message-1" };
await processPayment(message, provider);
await processPayment(message, provider);
assert.strictEqual(charges, 2, "The duplicate side-effect seed was removed.");

let attempts = 0;
await assert.rejects(() =>
  callWithAmplifiedRetries(async () => {
    attempts += 1;
    throw new Error("unavailable");
  }),
);
assert.strictEqual(attempts, 9, "The retry amplification seed was removed.");

const migration = fs.readFileSync(
  path.join(root, "unsafe-migration/migration.sql"),
  "utf8",
);
assert.match(migration, /DROP\s+COLUMN/i);

const pom = fs.readFileSync(path.join(root, "kev-dependency/pom.xml"), "utf8");
assert.match(pom, /<artifactId>log4j-core<\/artifactId>/);
assert.match(pom, /<version>2[.]14[.]1<\/version>/);

assert.ok(
  Object.hasOwn(
    requestAttributes({ method: "GET", userId: "unbounded-user-value" }),
    "user.id",
  ),
  "The high-cardinality telemetry seed was removed.",
);

const documents = [
  { tenantId: "tenant-a", id: "a" },
  { tenantId: "tenant-b", id: "b" },
];
assert.strictEqual(
  listDocuments({ tenantId: "tenant-a" }, documents).length,
  2,
  "The cross-tenant access seed was removed.",
);

const seedFiles = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, entry.name, "seed.json"));
assert.strictEqual(seedFiles.length, 7);
for (const seedFile of seedFiles) {
  const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  assert.ok(seed.id && seed.class && seed.expected && seed.control && seed.risk_mode);
}

console.log("Seven Rivet reference defects are present.");
