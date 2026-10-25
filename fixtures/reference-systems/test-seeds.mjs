import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { canReadInvoice } from "./broken-authorization/system.mjs";
import { listDocuments } from "./cross-tenant-data/system.mjs";
import { processPayment } from "./duplicate-side-effect/system.mjs";
import { requestAttributes } from "./high-cardinality-telemetry/system.mjs";
import { callWithAmplifiedRetries } from "./retry-amplification/system.mjs";
import {
  applyStatus,
  processOrder,
} from "./distributed-failure-recovery/system.mjs";

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

const duplicateEffects = { reserves: 0, charges: 0 };
const duplicateGateway = {
  async reserve() {
    duplicateEffects.reserves += 1;
  },
  async charge() {
    duplicateEffects.charges += 1;
    return { status: "charged" };
  },
};
const orderMessage = { orderId: "order-1", amount: 100 };
await processOrder(orderMessage, duplicateGateway);
await processOrder(orderMessage, duplicateGateway);
assert.deepStrictEqual(
  duplicateEffects,
  { reserves: 2, charges: 2 },
  "The duplicate distributed-delivery seed was removed.",
);

const delayedOrder = { status: "created", sequence: 0 };
applyStatus(delayedOrder, { status: "paid", sequence: 2 });
applyStatus(delayedOrder, { status: "authorized", sequence: 1 });
assert.deepStrictEqual(
  delayedOrder,
  { status: "authorized", sequence: 1 },
  "The delayed out-of-order delivery seed was removed.",
);

let partialReserves = 0;
let partialCharges = 0;
const partialGateway = {
  async reserve() {
    partialReserves += 1;
  },
  async charge() {
    partialCharges += 1;
    if (partialCharges === 1) throw new Error("charge unavailable");
    return { status: "charged" };
  },
};
await assert.rejects(() => processOrder(orderMessage, partialGateway));
await processOrder(orderMessage, partialGateway);
assert.strictEqual(
  partialReserves,
  2,
  "The partial-completion recovery seed was removed.",
);

let lostResponseCharges = 0;
const lostResponseGateway = {
  async reserve() {},
  async charge() {
    lostResponseCharges += 1;
    if (lostResponseCharges === 1) {
      throw new Error("response lost after provider completion");
    }
    return { status: "charged" };
  },
};
await assert.rejects(() => processOrder(orderMessage, lostResponseGateway));
await processOrder(orderMessage, lostResponseGateway);
assert.strictEqual(
  lostResponseCharges,
  2,
  "The lost-response recovery seed was removed.",
);

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
assert.strictEqual(seedFiles.length, 8);
for (const seedFile of seedFiles) {
  const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  assert.ok(seed.id && seed.class && seed.expected && seed.control && seed.risk_mode);
}

console.log("Eight Rivet reference defects are present.");
