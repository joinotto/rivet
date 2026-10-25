import fs from "fs";

const SECTION_KEYS = new Map([
  ["target", "target"],
  ["invariants", "invariants"],
  ["threats and failure cases", "failure_cases"],
  ["verification", "verification"],
  ["open risks", "open_risks"],
]);

function cleanLines(lines) {
  return lines
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^(current behavior|required behavior|success measure|out of scope):$/i.test(line));
}

export function extractChangeRecord(file) {
  const body = fs.readFileSync(file, "utf8");
  const sections = {
    target: [],
    invariants: [],
    failure_cases: [],
    verification: [],
    open_risks: [],
  };
  let current = null;
  for (const line of body.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = SECTION_KEYS.get(heading[1].toLowerCase()) || null;
      continue;
    }
    if (current) sections[current].push(line);
  }
  for (const key of Object.keys(sections)) sections[key] = cleanLines(sections[key]);
  return {
    evidence_class: "observed",
    source: file,
    ...sections,
  };
}

export function testFamilies(riskMode, record) {
  const families = [
    {
      id: "focused-example",
      purpose: "Verify the named required behavior with focused examples.",
    },
    {
      id: "regression",
      purpose: "Preserve each explicit invariant and previously supported behavior.",
    },
  ];
  if (riskMode !== "local") {
    families.push(
      {
        id: "integration",
        purpose: "Verify affected data and service boundaries.",
      },
      {
        id: "contract",
        purpose: "Verify externally visible request, response, event, or job behavior.",
      },
    );
  }
  if (riskMode === "distributed" || riskMode === "critical") {
    families.push(
      {
        id: "duplicate-delivery",
        purpose: "Verify that repeated delivery does not repeat an unsafe side effect.",
      },
      {
        id: "partial-failure",
        purpose: "Verify interruption, retry, and recovery behavior.",
      },
      {
        id: "compatibility",
        purpose: "Verify old and new participants during the rollout window.",
      },
    );
  }
  if (riskMode === "critical") {
    families.push(
      {
        id: "negative-security",
        purpose: "Verify that unauthorized and malformed operations fail closed.",
      },
      {
        id: "recovery",
        purpose: "Exercise rollback or recovery with representative state.",
      },
      {
        id: "independent-design",
        purpose: "Have an independent reviewer design tests from requirements and threats.",
      },
    );
  }
  if (record?.failure_cases?.length) {
    families.push({
      id: "recorded-failures",
      purpose: "Create one observable test for each recorded threat or failure case.",
    });
  }
  return families;
}
