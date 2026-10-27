import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workflow = fs.readFileSync(new URL("../.github/workflows/npm-publish.yml", import.meta.url), "utf8");
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /github\.repository == 'joinotto\/rivet' && github\.ref == 'refs\/heads\/main'/);
assert.match(workflow, /needs: check/);
assert.match(workflow, /environment: npm/);
assert.match(workflow, /id-token: write/);
assert.match(workflow, /test "\$SOURCE_REVISION" = "\$GITHUB_SHA"/);
assert.match(workflow, /test -z "\$\(git status --porcelain\)"/);
assert.match(workflow, /assert\.equal\(metadata\.name, "@ottoai\/rivet"\)/);
assert.match(workflow, /npm@12\.2\.1/);
assert.match(workflow, /--ignore-scripts --access public --tag "\$PUBLISH_CHANNEL" --provenance/);
assert.match(workflow, /PUBLISH_CHANNEL: \$\{\{ inputs\.channel \}\}/);
assert.match(workflow, /SOURCE_CHANNEL: \$\{\{ inputs\.channel \}\}/);
assert.match(workflow, /case "\$PUBLISH_CHANNEL" in\s+next\|latest\) ;;/);
assert.equal((workflow.match(/persist-credentials: false/g) || []).length, 2);
assert.doesNotMatch(workflow, /secrets\.|NODE_AUTH_TOKEN|NPM_TOKEN|contents: write|pull_request_target:/);
assert.doesNotMatch(workflow.split("  publish:")[0], /id-token: write/);
for (const action of workflow.matchAll(/uses: ([^\s]+)@([^\s]+)/g)) {
  assert.match(action[2], /^[a-f0-9]{40}$/);
}
const guard = workflow.match(/node --input-type=module <<'JS'\n([\s\S]*?)\n          JS/)[1];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-publish-guard-"));
const metadata = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
function guarded(overrides = {}, environment = {}) {
  fs.writeFileSync(path.join(temporary, "package.json"), JSON.stringify({ ...metadata, ...overrides }));
  return spawnSync(process.execPath, ["--input-type=module", "--eval", guard], {
    cwd: temporary, encoding: "utf8", timeout: 10000,
    env: { ...process.env, SOURCE_REVISION: "a".repeat(40), SOURCE_VERSION: metadata.version,
      SOURCE_CHANNEL: metadata.publishConfig.tag, ...environment },
  });
}
try {
  assert.equal(guarded().status, 0);
  const preview = "0.1.4-preview.1";
  assert.equal(guarded({
    version: preview, publishConfig: { ...metadata.publishConfig, tag: "next" },
  }, { SOURCE_VERSION: preview, SOURCE_CHANNEL: "next" }).status, 0);
  for (const [overrides, environment] of [
    [{ name: "rivet" }, {}],
    [{ name: "@another/rivet" }, {}],
    [{ version: "1.0.0" }, { SOURCE_VERSION: "1.0.0" }],
    [{ version: "0.1.4" }, { SOURCE_VERSION: "0.1.4" }],
    [{ publishConfig: { ...metadata.publishConfig, tag: "next" } }, { SOURCE_CHANNEL: "next" }],
    [{ version: preview }, { SOURCE_VERSION: preview }],
    [{ publishConfig: { ...metadata.publishConfig, tag: "beta" } }, { SOURCE_CHANNEL: "beta" }],
    [{}, { SOURCE_CHANNEL: "next" }],
    [{}, { SOURCE_CHANNEL: "latest; echo unsafe" }],
    [{ publishConfig: { ...metadata.publishConfig, provenance: false } }, {}],
    [{}, { SOURCE_VERSION: "0.1.2-preview.999" }],
    [{}, { SOURCE_REVISION: "main" }],
  ]) assert.notEqual(guarded(overrides, environment).status, 0);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log("npm release guards passed: preview channel and exact initial stable exception; external authentication is not tested.");
