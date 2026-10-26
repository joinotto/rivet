#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { sourceForHost } from "./install-skill.mjs";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = path.join(repository, "skills", "rivet");
const argv = process.argv.slice(2);
const outputFlag = argv.indexOf("--output");
const output = path.resolve(
  repository,
  outputFlag >= 0 ? argv[outputFlag + 1] : "dist",
);
const force = argv.includes("--force");
const allowedRoots = [repository, fs.realpathSync(os.tmpdir())];

const hosts = [
  {
    id: "codex",
    install_path: ".agents/skills/rivet or the configured Codex skills directory",
    include_agent_metadata: true,
  },
  {
    id: "claude-code",
    install_path: ".claude/skills/rivet",
    include_agent_metadata: false,
  },
];

function copyDirectory(from, to, includeAgentMetadata) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (!includeAgentMetadata && entry.name === "agents") continue;
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, includeAgentMetadata);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

const outputParent = fs.existsSync(path.dirname(output))
  ? fs.realpathSync(path.dirname(output))
  : path.dirname(output);
const canonicalOutput = path.join(outputParent, path.basename(output));
const allowed = allowedRoots.some(
  (root) =>
    canonicalOutput !== root &&
    canonicalOutput.startsWith(`${root}${path.sep}`),
);
if (!allowed) {
  console.error("Output must be inside the Rivet repository or system temporary directory.");
  process.exit(1);
}

if (fs.existsSync(output)) {
  if (!force) {
    console.error(`Output already exists: ${output}`);
    console.error("Use --force to replace generated packages.");
    process.exit(1);
  }
  fs.rmSync(output, { recursive: true });
}

for (const host of hosts) {
  const target = path.join(output, host.id, "rivet");
  copyDirectory(source, target, host.include_agent_metadata);
  const identity = sourceForHost(host.id);
  const manifest = {
    schema: 1,
    host: host.id,
    version: identity.version,
    source_revision: identity.revision,
    source_state: identity.state,
    canonical_source: "skills/rivet",
    install_path: host.install_path,
    capabilities: {
      local_scripts: true,
      evidence_receipts: true,
      model_provider_independent: true,
      approval_mapping: "host-dependent",
      sandbox_mapping: "host-dependent",
    },
  };
  fs.writeFileSync(
    path.join(output, host.id, "rivet-host.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 },
  );
  fs.copyFileSync(
    path.join(repository, "scripts/install-skill.mjs"),
    path.join(output, host.id, "install.mjs"),
  );
  for (const document of ["LICENSE", "NOTICE"]) {
    fs.copyFileSync(path.join(repository, document), path.join(output, host.id, document));
  }
}

console.log(`Generated ${hosts.length} Rivet host packages in ${output}`);
