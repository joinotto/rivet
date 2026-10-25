import fs from "fs";
import path from "path";

function seedFiles(root, output = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) seedFiles(absolute, output);
    if (entry.isFile() && entry.name === "seed.json") output.push(absolute);
  }
  return output;
}

export function evaluateFindings(fixturesRoot, findingsFile) {
  const seeds = seedFiles(fixturesRoot).map((file) => {
    const seed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      ...seed,
      fixture: path.relative(fixturesRoot, path.dirname(file)),
    };
  });
  const document = JSON.parse(fs.readFileSync(findingsFile, "utf8"));
  if (!Array.isArray(document.findings)) {
    throw new Error("The evaluation artifact requires a findings array.");
  }
  const matchedFindingIndexes = new Set();
  const detected = [];
  const missed = [];
  for (const seed of seeds) {
    const index = document.findings.findIndex(
      (finding, findingIndex) =>
        !matchedFindingIndexes.has(findingIndex) &&
        (finding.seed_id === seed.id ||
          (finding.fixture === seed.fixture &&
            finding.class === seed.class)),
    );
    if (index >= 0) {
      matchedFindingIndexes.add(index);
      detected.push({
        seed_id: seed.id,
        fixture: seed.fixture,
        finding: document.findings[index],
      });
    } else {
      missed.push({
        seed_id: seed.id,
        fixture: seed.fixture,
        class: seed.class,
      });
    }
  }
  const unexpected = document.findings.filter(
    (_, index) => !matchedFindingIndexes.has(index),
  );
  const truePositives = detected.length;
  const falsePositives = unexpected.length;
  const falseNegatives = missed.length;
  const precision =
    truePositives + falsePositives
      ? truePositives / (truePositives + falsePositives)
      : null;
  const recall =
    truePositives + falseNegatives
      ? truePositives / (truePositives + falseNegatives)
      : null;
  return {
    schema: 1,
    kind: "seeded-defect-evaluation",
    evidence_class: "derived",
    fixtures: fixturesRoot,
    findings: findingsFile,
    seed_count: seeds.length,
    detected,
    missed,
    unexpected,
    metrics: {
      true_positives: truePositives,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      precision,
      recall,
    },
    decision:
      falseNegatives || falsePositives ? "gaps-observed" : "expected-findings",
    limitations: [
      "This scorer measures only published seeds and declared finding matches.",
      "A perfect score can overfit the fixtures and does not prove real-world correctness.",
      "Independent review must confirm ambiguous matches and finding quality.",
    ],
  };
}

function mean(values) {
  const observed = values.filter(Number.isFinite);
  return observed.length
    ? observed.reduce((sum, value) => sum + value, 0) / observed.length
    : null;
}

function pairAgreement(left, right, seedIds) {
  let agreements = 0;
  let leftPositive = 0;
  let rightPositive = 0;
  for (const seedId of seedIds) {
    const leftFound = left.has(seedId);
    const rightFound = right.has(seedId);
    if (leftFound === rightFound) agreements += 1;
    if (leftFound) leftPositive += 1;
    if (rightFound) rightPositive += 1;
  }
  const count = seedIds.length;
  const observed = count ? agreements / count : null;
  const leftRate = count ? leftPositive / count : 0;
  const rightRate = count ? rightPositive / count : 0;
  const expected = leftRate * rightRate +
    (1 - leftRate) * (1 - rightRate);
  const kappa = observed === null || expected === 1
    ? null
    : (observed - expected) / (1 - expected);
  return { observed_agreement: observed, cohen_kappa: kappa };
}

export function evaluateCampaign(campaign) {
  const faults = [];
  const warnings = [];
  if (campaign?.schema !== 1 || campaign?.kind !== "evaluation-campaign") {
    faults.push("The file must use Rivet evaluation-campaign schema 1.");
  }
  const seeds = Array.isArray(campaign?.seeds) ? campaign.seeds : [];
  const seedIds = seeds.map((seed) => seed?.id).filter(Boolean);
  if (!seedIds.length) faults.push("The campaign requires seeded defects.");
  if (new Set(seedIds).size !== seedIds.length) {
    faults.push("The campaign contains duplicate seed ids.");
  }
  const allowedConditions = new Set([
    "agent-without-rivet",
    "prose-only-rivet",
    "tool-backed-rivet",
    "experienced-human",
  ]);
  const runs = Array.isArray(campaign?.runs) ? campaign.runs : [];
  const runIds = new Set();
  const normalizedRuns = [];
  for (const run of runs) {
    const label = run?.id || "record";
    if (!run?.id) {
      faults.push("Each evaluation run requires an id.");
    } else if (runIds.has(run.id)) {
      faults.push(`Duplicate evaluation run id: ${run.id}.`);
    } else {
      runIds.add(run.id);
    }
    if (!allowedConditions.has(run?.condition)) {
      faults.push(`Evaluation run ${label} has an invalid condition.`);
    }
    if (run?.blind !== true) {
      faults.push(`Evaluation run ${label} must be blind to seeded answers.`);
    }
    for (const field of ["reviewer_id", "artifact"]) {
      if (typeof run?.[field] !== "string" || !run[field].trim()) {
        faults.push(`Evaluation run ${label} requires ${field}.`);
      }
    }
    for (const field of ["defects_introduced", "duration_seconds"]) {
      if (!Number.isFinite(run?.[field]) || run[field] < 0) {
        faults.push(`Evaluation run ${label} requires non-negative ${field}.`);
      }
    }
    if (
      !Number.isFinite(run?.evidence_completeness) ||
      run.evidence_completeness < 0 ||
      run.evidence_completeness > 1
    ) {
      faults.push(
        `Evaluation run ${label} evidence_completeness must be from 0 to 1.`,
      );
    }
    const findings = Array.isArray(run?.findings) ? run.findings : [];
    const foundSeeds = new Set();
    let unexpected = 0;
    for (const finding of findings) {
      if (seedIds.includes(finding?.seed_id)) {
        foundSeeds.add(finding.seed_id);
      } else {
        unexpected += 1;
      }
    }
    const truePositives = foundSeeds.size;
    const falseNegatives = seedIds.length - truePositives;
    const precision = truePositives + unexpected
      ? truePositives / (truePositives + unexpected)
      : null;
    const recall = seedIds.length ? truePositives / seedIds.length : null;
    normalizedRuns.push({
      id: run?.id || null,
      condition: run?.condition || null,
      reviewer_id: run?.reviewer_id || null,
      artifact: run?.artifact || null,
      found_seed_ids: [...foundSeeds].sort(),
      unexpected_findings: unexpected,
      defects_introduced: run?.defects_introduced ?? null,
      duration_seconds: run?.duration_seconds ?? null,
      evidence_completeness: run?.evidence_completeness ?? null,
      metrics: {
        true_positives: truePositives,
        false_positives: unexpected,
        false_negatives: falseNegatives,
        precision,
        recall,
      },
    });
  }
  if (!runs.length) faults.push("The campaign requires evaluation runs.");

  const conditions = {};
  for (const condition of allowedConditions) {
    const conditionRuns = normalizedRuns.filter(
      (run) => run.condition === condition,
    );
    conditions[condition] = {
      run_count: conditionRuns.length,
      mean_precision: mean(conditionRuns.map((run) => run.metrics.precision)),
      mean_recall: mean(conditionRuns.map((run) => run.metrics.recall)),
      mean_defects_introduced: mean(
        conditionRuns.map((run) => run.defects_introduced),
      ),
      mean_duration_seconds: mean(
        conditionRuns.map((run) => run.duration_seconds),
      ),
      mean_evidence_completeness: mean(
        conditionRuns.map((run) => run.evidence_completeness),
      ),
    };
    if (!conditionRuns.length) {
      warnings.push(`The campaign has no ${condition} run.`);
    }
  }

  const agreement = [];
  for (let leftIndex = 0; leftIndex < normalizedRuns.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < normalizedRuns.length;
      rightIndex += 1
    ) {
      const left = normalizedRuns[leftIndex];
      const right = normalizedRuns[rightIndex];
      const metrics = pairAgreement(
        new Set(left.found_seed_ids),
        new Set(right.found_seed_ids),
        seedIds,
      );
      agreement.push({
        left_run: left.id,
        right_run: right.id,
        ...metrics,
      });
    }
  }
  if (normalizedRuns.length < 2) {
    warnings.push("The campaign needs at least two runs for reviewer agreement.");
  }

  const complete = [...allowedConditions].every(
    (condition) => conditions[condition].run_count > 0,
  );
  return {
    schema: 1,
    kind: "evaluation-campaign-result",
    evidence_class: "derived",
    seed_count: seedIds.length,
    runs: normalizedRuns,
    conditions,
    reviewer_agreement: agreement,
    faults,
    warnings,
    decision: faults.length
      ? "invalid-campaign"
      : complete
        ? "comparison-ready"
        : "incomplete-campaign",
    limitations: [
      "Scores apply only to the declared seeds, tasks, reviewers, and run conditions.",
      "Blindness and reviewer experience require procedural evidence outside this calculation.",
      "Pairwise agreement does not determine which reviewer is correct.",
    ],
  };
}
