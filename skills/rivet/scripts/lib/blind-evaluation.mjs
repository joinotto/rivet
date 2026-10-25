import fs from "fs";
import path from "path";

const CONDITIONS = new Set([
  "agent-without-rivet",
  "prose-only-rivet",
  "tool-backed-rivet",
]);

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyTree(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    if (entry.isFile()) copyFile(from, to);
  }
}

export function prepareBlindWorkspace({
  repository,
  fixtures,
  destination,
  condition,
}) {
  if (!CONDITIONS.has(condition)) {
    throw new Error(`Unsupported blind-evaluation condition: ${condition}.`);
  }
  const copied = [];
  for (const entry of fs.readdirSync(fixtures, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fixtureRoot = path.join(fixtures, entry.name);
    for (const file of fs.readdirSync(fixtureRoot, { withFileTypes: true })) {
      if (!file.isFile() || file.name === "seed.json") continue;
      const relative = path.join("fixtures", entry.name, file.name);
      copyFile(path.join(fixtureRoot, file.name), path.join(destination, relative));
      copied.push(relative);
    }
  }
  if (condition === "prose-only-rivet") {
    copyFile(
      path.join(repository, "skills/rivet/SKILL.md"),
      path.join(destination, "RIVET-GUIDANCE.md"),
    );
  }
  if (condition === "tool-backed-rivet") {
    copyTree(
      path.join(repository, "skills/rivet"),
      path.join(destination, "skills/rivet"),
    );
  }
  return copied.sort();
}

export function blindEvaluationPrompt(condition, files) {
  const conditionInstruction = condition === "agent-without-rivet"
    ? "Review the source directly. Rivet guidance and tools are not available."
    : condition === "prose-only-rivet"
      ? "Read RIVET-GUIDANCE.md. Apply its reasoning guidance, but no Rivet executable tools are available."
      : "Read skills/rivet/SKILL.md. Use its read-only executable tools when they provide relevant evidence.";
  return [
    "Perform a blind backend engineering defect review.",
    conditionInstruction,
    "The workspace intentionally excludes answer keys and seed metadata.",
    "Inspect every listed fixture.",
    "Report concrete defects only. Do not infer that a fixture is safe from missing evidence.",
    "Use the fixture directory name in each finding.",
    "Return only JSON that matches the supplied schema.",
    "",
    "Files:",
    ...files.map((file) => `- ${file}`),
  ].join("\n");
}

export const blindEvaluationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["findings", "limitations"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "fixture",
          "class",
          "summary",
          "evidence",
          "confidence",
        ],
        properties: {
          fixture: { type: "string", minLength: 1 },
          class: { type: "string", minLength: 1 },
          summary: { type: "string", minLength: 1 },
          evidence: { type: "string", minLength: 1 },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
        },
      },
    },
    limitations: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
};
