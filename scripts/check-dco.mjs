import { spawnSync } from "node:child_process";

function requestedRange() {
  const rangeIndex = process.argv.indexOf("--range");
  if (rangeIndex !== -1) {
    const value = process.argv[rangeIndex + 1];
    if (!value) throw new Error("--range requires a Git revision range");
    return value;
  }

  if (process.env.GITHUB_BASE_REF) {
    const head = process.env.DCO_HEAD_SHA || "HEAD";
    return `origin/${process.env.GITHUB_BASE_REF}..${head}`;
  }
  return "HEAD^..HEAD";
}

const range = requestedRange();
const faults = [];
const result = spawnSync(
  "git",
  ["log", "--format=%H%x00%an%x00%ae%x00%B%x00", range],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  faults.push(result.stderr.trim() || `cannot inspect ${range}`);
} else {
  const fields = result.stdout.split("\0");
  const commits = [];
  for (let index = 0; index + 3 < fields.length; index += 4) {
    const [revision, authorName, authorEmail, message] = fields.slice(index, index + 4);
    if (!revision.trim()) continue;
    commits.push({ revision: revision.trim(), authorName, authorEmail, message });
  }

  if (commits.length === 0) {
    faults.push(`no commits found in ${range}`);
  }

  const failures = [];
  for (const commit of commits) {
    const expected = `${commit.authorName} <${commit.authorEmail}>`.toLowerCase();
    const signoffs = commit.message
      .split(/\r?\n/)
      .filter((line) => /^Signed-off-by:\s+/i.test(line))
      .map((line) => line.replace(/^Signed-off-by:\s+/i, "").trim().toLowerCase());

    if (!signoffs.includes(expected)) {
      failures.push({
        revision: commit.revision,
        author: `${commit.authorName} <${commit.authorEmail}>`
      });
    }
  }

  const report = {
    schema: 1,
    kind: "dco-signoff-check",
    range,
    commits: commits.length,
    failures,
    faults,
    decision: failures.length === 0 && faults.length === 0 ? "pass" : "fail"
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length > 0 || faults.length > 0) process.exitCode = 1;
}
