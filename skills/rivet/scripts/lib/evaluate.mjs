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
