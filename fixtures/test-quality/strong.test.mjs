import assert from "node:assert/strict";
import test from "node:test";
import { canCreateAccount } from "./source.mjs";

test("the minimum age can create an account", () => {
  assert.strictEqual(canCreateAccount(18), true);
});

test("an age below the minimum cannot create an account", () => {
  assert.strictEqual(canCreateAccount(17), false);
});
