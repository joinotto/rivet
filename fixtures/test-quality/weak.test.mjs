import assert from "node:assert/strict";
import test from "node:test";
import { canCreateAccount } from "./source.mjs";

test("an adult can create an account", () => {
  assert.strictEqual(canCreateAccount(21), true);
});
