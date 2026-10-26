#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const requiredFoundationFiles = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "GOVERNANCE.md",
  "MAINTAINERS.md",
  "SUPPORT.md",
  "ROADMAP.md",
  "CHANGELOG.md",
  "RELEASING.md",
  "THREAT-MODEL.md",
  "docs/architecture.md"
];

const requiredLicenseMetadata = ["REUSE.toml", "LICENSES/Apache-2.0.txt"];
export const requiredCommunityFiles = [
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/documentation.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/pull_request_template.md"
];

const navigatedFoundationFiles = requiredFoundationFiles.filter(
  (relative) => !["LICENSE", "NOTICE", "README.md"].includes(relative)
);

function read(root, relative, faults) {
  const file = path.join(root, relative);
  let descriptor;
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
    );
  } catch (error) {
    faults.push(
      error.code === "ENOENT"
        ? `Required file is missing: ${relative}`
        : `Required file cannot be opened safely: ${relative}`
    );
    return "";
  }
  try {
    if (!fs.fstatSync(descriptor).isFile()) {
      faults.push(`Required path must be a regular file: ${relative}`);
      return "";
    }
    const content = fs.readFileSync(descriptor, "utf8");
    if (!content.trim()) faults.push(`Required file is empty: ${relative}`);
    return content;
  } finally {
    fs.closeSync(descriptor);
  }
}

export function validateOpenSourceFoundation(root) {
  const faults = [];
  const documents = Object.fromEntries(
    [
      ...requiredFoundationFiles,
      ...requiredLicenseMetadata,
      ...requiredCommunityFiles
    ].map((relative) => [
      relative,
      read(root, relative, faults)
    ])
  );

  let packageDocument;
  try {
    packageDocument = JSON.parse(read(root, "package.json", faults));
  } catch (error) {
    faults.push(`package.json is not valid JSON: ${error.message}`);
  }
  if (packageDocument?.license !== "Apache-2.0") {
    faults.push("package.json license must be Apache-2.0.");
  }
  if (!documents.LICENSE.includes("Apache License") || !documents.LICENSE.includes("Version 2.0")) {
    faults.push("LICENSE must contain the Apache License 2.0 text.");
  }
  if (documents["LICENSES/Apache-2.0.txt"] !== documents.LICENSE) {
    faults.push("LICENSES/Apache-2.0.txt must match the root Apache license text.");
  }
  if (
    !documents["REUSE.toml"].includes('SPDX-FileCopyrightText = "2026 Otto"') ||
    !documents["REUSE.toml"].includes('SPDX-License-Identifier = "Apache-2.0"')
  ) {
    faults.push("REUSE.toml must declare the project copyright and Apache-2.0 license.");
  }
  if (!/^Copyright \d{4} .+/m.test(documents.NOTICE)) {
    faults.push("NOTICE must contain a copyright statement.");
  }

  for (const relative of navigatedFoundationFiles) {
    const link = relative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`[(]${link}[)]`).test(documents["README.md"])) {
      faults.push(`README.md must link to ${relative}.`);
    }
  }
  if (
    !documents["MAINTAINERS.md"].includes("## Current maintainers") ||
    !documents["MAINTAINERS.md"].includes("GOVERNANCE.md")
  ) {
    faults.push("MAINTAINERS.md must identify current maintainers and link to governance.");
  }
  if (!documents["SECURITY.md"].includes("security/advisories/new")) {
    faults.push("SECURITY.md must identify the private vulnerability report route.");
  }
  if (!documents["SUPPORT.md"].includes("Security reports")) {
    faults.push("SUPPORT.md must separate security reports from public support.");
  }
  if (
    !documents["CODE_OF_CONDUCT.md"].includes("Contributor Covenant") ||
    !documents["CODE_OF_CONDUCT.md"].includes("version 2.1") ||
    !documents["CODE_OF_CONDUCT.md"].includes("support@joinotto.com") ||
    !documents["CODE_OF_CONDUCT.md"].includes("conflict of interest")
  ) {
    faults.push("CODE_OF_CONDUCT.md must identify its standard, private report route, and conflict escalation.");
  }
  if (
    !documents[".github/ISSUE_TEMPLATE/config.yml"].includes(
      "security/advisories/new"
    ) ||
    !documents[".github/ISSUE_TEMPLATE/bug.yml"].includes(
      "Do not include credentials"
    )
  ) {
    faults.push("Public issue intake must route sensitive reports to the private security channel.");
  }
  if (
    !documents[".github/pull_request_template.md"].includes("DCO sign-off") ||
    !documents[".github/pull_request_template.md"].includes(
      "Security and privacy"
    )
  ) {
    faults.push("The pull-request template must require contribution and security evidence.");
  }

  return {
    schema: 1,
    kind: "open-source-foundation-conformance",
    required_files: requiredFoundationFiles.length,
    community_files: requiredCommunityFiles.length,
    license: packageDocument?.license || null,
    faults,
    decision: faults.length ? "invalid" : "valid",
    limitations: [
      "This check validates repository artifacts and selected consistency rules.",
      "It does not provide legal review or prove that external project processes are effective."
    ]
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateOpenSourceFoundation(repository);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.decision !== "valid") process.exitCode = 1;
}
