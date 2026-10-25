export function githubIssuePlan(action, repository, labels = []) {
  const title = `[${action.id}] ${action.change}`.slice(0, 240);
  const body = [
    "## Preventive action",
    "",
    `Incident: ${action.incident_id}`,
    "",
    `Contributing condition: ${action.contributing_condition}`,
    "",
    `Required change: ${action.change}`,
    "",
    `Owner: ${action.owner}`,
    "",
    `Priority: ${action.priority}`,
    "",
    `Due date: ${action.due_at}`,
    "",
    "## Verification",
    "",
    `Method: ${action.verification?.method || "Not yet recorded."}`,
    "",
    "Evidence:",
    ...(action.verification?.evidence?.length
      ? action.verification.evidence.map((item) => `- ${item}`)
      : ["- Not yet recorded."]),
    "",
    `Result: ${action.verification?.result || "Not yet recorded."}`,
    "",
    "This issue was created from a Rivet preventive-action record.",
  ].join("\n");
  const args = [
    "issue",
    "create",
    "--repo",
    repository,
    "--title",
    title,
    "--body-file",
    "-",
  ];
  for (const label of labels) args.push("--label", label);
  return {
    provider: "github",
    executable: "gh",
    args,
    repository,
    title,
    body,
    labels,
  };
}

export function parseGithubIssue(output) {
  const url = String(output || "")
    .split(/\s+/)
    .find((item) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(item));
  if (!url) throw new Error("GitHub CLI returned no issue URL.");
  const number = Number(url.split("/").at(-1));
  return { number, url };
}
