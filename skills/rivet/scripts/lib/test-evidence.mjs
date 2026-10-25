import fs from "fs";

function percentage(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function metric(total, covered, skipped = 0) {
  const normalizedTotal = Number(total);
  const normalizedCovered = Number(covered);
  return {
    total: normalizedTotal,
    covered: normalizedCovered,
    skipped: Number(skipped),
    percent: normalizedTotal
      ? Number(((normalizedCovered / normalizedTotal) * 100).toFixed(2))
      : null,
  };
}

function xmlNumber(xml, name) {
  const match = xml.match(new RegExp(`\\b${name}=["']([0-9.]+)["']`));
  return match ? Number(match[1]) : null;
}

function normalizeCoverageXml(xml) {
  if (/<coverage\b/.test(xml)) {
    const linesCovered = xmlNumber(xml, "lines-covered");
    const linesValid = xmlNumber(xml, "lines-valid");
    const branchesCovered = xmlNumber(xml, "branches-covered");
    const branchesValid = xmlNumber(xml, "branches-valid");
    if (linesCovered === null || linesValid === null) {
      throw new Error("Cobertura XML has no aggregate line counts.");
    }
    return {
      format: "cobertura-xml",
      metrics: {
        lines: metric(linesValid, linesCovered),
        ...(branchesCovered !== null && branchesValid !== null
          ? { branches: metric(branchesValid, branchesCovered) }
          : {}),
      },
    };
  }
  if (/<report\b/.test(xml) && /<counter\b/.test(xml)) {
    const counters = {};
    for (const match of xml.matchAll(
      /<counter\b[^>]*type=["']([^"']+)["'][^>]*missed=["'](\d+)["'][^>]*covered=["'](\d+)["'][^>]*\/?>/g,
    )) {
      counters[match[1]] = {
        missed: Number(match[2]),
        covered: Number(match[3]),
      };
    }
    const mapping = {
      LINE: "lines",
      BRANCH: "branches",
      METHOD: "functions",
      INSTRUCTION: "instructions",
    };
    const metrics = {};
    for (const [counter, name] of Object.entries(mapping)) {
      if (!counters[counter]) continue;
      metrics[name] = metric(
        counters[counter].missed + counters[counter].covered,
        counters[counter].covered,
      );
    }
    if (!Object.keys(metrics).length) {
      throw new Error("JaCoCo XML has no aggregate counters.");
    }
    return { format: "jacoco-xml", metrics };
  }
  throw new Error("The XML artifact is not Cobertura or JaCoCo coverage.");
}

function normalizeLcov(body) {
  const totals = {
    lines: [0, 0],
    branches: [0, 0],
    functions: [0, 0],
  };
  const fields = {
    LF: ["lines", 0],
    LH: ["lines", 1],
    BRF: ["branches", 0],
    BRH: ["branches", 1],
    FNF: ["functions", 0],
    FNH: ["functions", 1],
  };
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^(LF|LH|BRF|BRH|FNF|FNH):(\d+)$/);
    if (!match) continue;
    const [name, position] = fields[match[1]];
    totals[name][position] += Number(match[2]);
  }
  const metrics = {};
  for (const [name, [total, covered]] of Object.entries(totals)) {
    if (total) metrics[name] = metric(total, covered);
  }
  if (!metrics.lines) throw new Error("LCOV data has no line summary.");
  return { format: "lcov", metrics };
}

function normalizeGoCover(body) {
  if (!/^mode:\s*(set|count|atomic)\s*$/m.test(body)) {
    throw new Error("The artifact is not a Go cover profile.");
  }
  let total = 0;
  let covered = 0;
  for (const line of body.split(/\r?\n/).slice(1)) {
    const match = line.match(/\s(\d+)\s+(\d+)$/);
    if (!match) continue;
    const statements = Number(match[1]);
    total += statements;
    if (Number(match[2]) > 0) covered += statements;
  }
  if (!total) throw new Error("The Go cover profile has no statement blocks.");
  return {
    format: "go-coverprofile",
    metrics: { statements: metric(total, covered) },
  };
}

export function normalizeCoverage(file) {
  const body = fs.readFileSync(file, "utf8");
  let normalized;
  if (body.trimStart().startsWith("{")) {
    const document = JSON.parse(body);
    const total = document.total;
    if (!total) throw new Error("Coverage JSON has no total record.");
    const metrics = {};
    for (const key of ["lines", "statements", "functions", "branches"]) {
      const item = total[key];
      if (!item) continue;
      metrics[key] = {
        total: Number(item.total),
        covered: Number(item.covered),
        skipped: Number(item.skipped || 0),
        percent: percentage(item.pct),
      };
    }
    normalized = { format: "istanbul-summary-json", metrics };
  } else if (body.trimStart().startsWith("<")) {
    normalized = normalizeCoverageXml(body);
  } else if (/^TN:|^SF:/m.test(body)) {
    normalized = normalizeLcov(body);
  } else {
    normalized = normalizeGoCover(body);
  }
  return {
    schema: 1,
    kind: "coverage",
    evidence_class: "observed",
    artifact: file,
    format: normalized.format,
    metrics: normalized.metrics,
    decision: Object.keys(normalized.metrics).length ? "observed" : "insufficient-evidence",
    limitations: [
      "Coverage shows executed code. It does not prove that tests detect incorrect behavior.",
      "Aggregate coverage can hide untested changed lines and critical branches.",
      "A missing metric means that the source format did not provide an aggregate value.",
    ],
  };
}

export function normalizeMutation(file) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  const mutants = Object.values(document.files || {})
    .flatMap((item) => item.mutants || []);
  const counts = {};
  for (const mutant of mutants) {
    const status = mutant.status || "Unknown";
    counts[status] = (counts[status] || 0) + 1;
  }
  const assessed = mutants.filter(
    (item) => !["Ignored", "CompileError"].includes(item.status),
  );
  const killed = assessed.filter((item) =>
    ["Killed", "Timeout"].includes(item.status),
  ).length;
  const survived = assessed.filter((item) => item.status === "Survived");
  return {
    schema: 1,
    kind: "mutation",
    evidence_class: "observed",
    artifact: file,
    counts,
    mutation_score:
      assessed.length ? Number(((killed / assessed.length) * 100).toFixed(2)) : null,
    surviving_mutants: survived.map((item) => ({
      id: item.id || null,
      mutator: item.mutatorName || null,
      location: item.location || null,
    })),
    decision: survived.length ? "test-gaps" : assessed.length ? "pass" : "insufficient-evidence",
    limitations: [
      "Mutation score depends on the selected source files, operators, and test command.",
      "Equivalent mutants can survive without representing a useful test gap.",
    ],
  };
}

function attribute(xml, name) {
  const match = xml.match(new RegExp(`${name}=["'](\\d+)["']`));
  return match ? Number(match[1]) : 0;
}

export function normalizeJunit(file, kind) {
  const xml = fs.readFileSync(file, "utf8");
  if (!/<testsuites?\b/.test(xml)) throw new Error("The artifact is not JUnit XML.");
  const tests = attribute(xml, "tests");
  const failures = attribute(xml, "failures");
  const errors = attribute(xml, "errors");
  const skipped = attribute(xml, "skipped");
  return {
    schema: 1,
    kind,
    evidence_class: "observed",
    artifact: file,
    tests,
    failures,
    errors,
    skipped,
    decision: failures || errors ? "fail" : tests ? "pass" : "insufficient-evidence",
    limitations: [
      "JUnit results describe executed cases only.",
      "A passing contract suite does not prove compatibility with untested consumers.",
    ],
  };
}

function testCases(xml) {
  const cases = [];
  const pattern = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const match of xml.matchAll(pattern)) {
    const attributes = match[1];
    const body = match[2] || "";
    const name = attributes.match(/\bname=["']([^"']+)["']/)?.[1];
    const className = attributes.match(/\bclassname=["']([^"']+)["']/)?.[1];
    if (!name) continue;
    const status = /<(failure|error)\b/.test(body)
      ? "fail"
      : /<skipped\b/.test(body)
        ? "skip"
        : "pass";
    cases.push({
      id: className ? `${className}::${name}` : name,
      status,
    });
  }
  return cases;
}

export function detectFlakes(files) {
  const history = new Map();
  files.forEach((file, run) => {
    const xml = fs.readFileSync(file, "utf8");
    if (!/<testsuites?\b/.test(xml)) throw new Error(`${file} is not JUnit XML.`);
    for (const item of testCases(xml)) {
      if (!history.has(item.id)) history.set(item.id, []);
      history.get(item.id).push({ run: run + 1, status: item.status });
    }
  });
  const flaky = [];
  const inconsistentPresence = [];
  for (const [id, observations] of history) {
    const statuses = new Set(observations.map((item) => item.status));
    if (statuses.has("pass") && statuses.has("fail")) {
      flaky.push({ id, observations });
    }
    if (observations.length !== files.length) {
      inconsistentPresence.push({
        id,
        observed_runs: observations.map((item) => item.run),
      });
    }
  }
  return {
    schema: 1,
    kind: "flake-detection",
    evidence_class: "derived",
    runs: files.length,
    flaky,
    inconsistent_presence: inconsistentPresence,
    decision: flaky.length ? "flakes-observed" : files.length > 1 ? "no-flakes-observed" : "insufficient-evidence",
    limitations: [
      "A finite set of passing runs cannot prove that a test is deterministic.",
      "Environment, order, seed, timing, and retry metadata must be preserved to diagnose a flake.",
      "A missing test can indicate selection drift and is reported separately.",
    ],
  };
}
