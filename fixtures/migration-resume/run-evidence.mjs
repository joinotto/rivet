import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateBatch } from "./migration.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "evidence.json");
const rows = [
  { id: 1, value: "alpha" },
  { id: 2, value: "bravo" },
  { id: 3, value: "charlie" },
  { id: 4, value: "delta" },
  { id: 5, value: "echo" },
];
const state = {
  cursor: 0,
  applied: new Set(),
  destination: new Map(),
};

const beforeInterruption = migrateBatch(rows, state, 2);
assert.deepStrictEqual(beforeInterruption, {
  processed: 2,
  cursor: 2,
  complete: false,
});

const durableCursor = state.cursor;
const resumedState = {
  cursor: durableCursor,
  applied: state.applied,
  destination: state.destination,
};
const resumeBatches = [];
while (resumedState.cursor < rows.at(-1).id) {
  resumeBatches.push(migrateBatch(rows, resumedState, 2));
}

assert.strictEqual(resumedState.applied.size, rows.length);
assert.deepStrictEqual(
  [...resumedState.destination],
  rows.map((row) => [row.id, row.value]),
);

const evidence = {
  schema: 1,
  kind: "migration-interruption-resume-evidence",
  evidence_class: "observed",
  revision: "migration-resume-fixture-v1",
  source_count: rows.length,
  migrated_count: resumedState.destination.size,
  validated_count: rows.filter(
    (row) => resumedState.destination.get(row.id) === row.value,
  ).length,
  interrupted: true,
  interruption_cursor: durableCursor,
  resumed: true,
  resume_batches: resumeBatches,
  duplicate_applications: rows.length - resumedState.applied.size,
  decision: "resume-observed",
  limitations: [
    "This fixture uses an in-memory durable-state model.",
    "It does not measure database locks, replicas, or concurrent production traffic.",
  ],
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
