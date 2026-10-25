export function reviewPacket({
  record,
  files,
  affectedComponents,
  risk,
  diff,
  revision,
}) {
  return {
    schema: 1,
    workflow: "independent-review",
    status: "prepared-not-reviewed",
    evidence_class: "derived",
    revision,
    requirements: record.target,
    invariants: record.invariants,
    failure_cases: record.failure_cases,
    open_risks: record.open_risks,
    changed_files: files,
    affected_components: affectedComponents,
    risk_mode: risk.mode,
    risk_signals: risk.signals,
    diff,
    reviewer_instructions: [
      "Review requirements and invariants before the diff.",
      "Identify correctness, security, data, concurrency, compatibility, recovery, and test-evidence gaps.",
      "Tie each finding to an observable behavior, invariant, threat, or failure mode.",
      "Do not accept the implementation explanation as evidence.",
      "State when the available evidence is insufficient.",
    ],
    omitted_to_reduce_anchoring: [
      "Implementation rationale.",
      "Author conclusions.",
      "Proposed review findings.",
    ],
    limitations: [
      "Packet creation is not an independent review.",
      "The diff does not show runtime state, external consumers, production data, or deployed configuration.",
    ],
  };
}

export function reviewMarkdown(packet) {
  const section = (title, values) => [
    `## ${title}`,
    "",
    ...(values.length ? values.map((item) => `- ${item}`) : ["- None recorded."]),
    "",
  ];
  return [
    "# Independent review packet",
    "",
    `Status: **${packet.status}**`,
    "",
    `Risk mode: **${packet.risk_mode}**`,
    "",
    ...section("Requirements", packet.requirements),
    ...section("Invariants", packet.invariants),
    ...section("Failure cases", packet.failure_cases),
    ...section("Open risks", packet.open_risks),
    ...section("Changed files", packet.changed_files.map((item) => `\`${item}\``)),
    ...section("Affected components", packet.affected_components),
    ...section("Reviewer instructions", packet.reviewer_instructions),
    "## Diff",
    "",
    "```diff",
    packet.diff || "No diff evidence was available.",
    "```",
    "",
    ...section("Limitations", packet.limitations),
  ].join("\n");
}
