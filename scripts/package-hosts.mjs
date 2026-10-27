#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { readSkillSource, sourceForHost } from "./install-skill.mjs";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = path.join(repository, "skills", "rivet");
const argv = process.argv.slice(2);
const seen = new Set();
for (let index = 0; index < argv.length; index += 1) {
  const flag = argv[index];
  if (!["--output", "--force"].includes(flag) || seen.has(flag)) {
    throw new Error(`Unknown or repeated option: ${flag}`);
  }
  seen.add(flag);
  if (flag === "--output" && (!argv[++index] || argv[index].startsWith("--"))) {
    throw new Error("--output requires a directory.");
  }
}
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

function copySnapshot(snapshot, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const directory of snapshot.inventory.directories) {
    fs.mkdirSync(path.join(to, directory), { recursive: true });
  }
  for (const file of snapshot.files) {
    fs.writeFileSync(path.join(to, file.path), file.content, { flag: "wx", mode: 0o644 });
  }
}

let ancestor = output;
while (!fs.existsSync(ancestor)) {
  const parent = path.dirname(ancestor);
  if (parent === ancestor) throw new Error("Cannot resolve the output directory.");
  ancestor = parent;
}
const canonicalOutput = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, output));
const allowed = allowedRoots.some(
  (root) =>
    canonicalOutput !== root &&
    canonicalOutput.startsWith(`${root}${path.sep}`),
);
if (!allowed) {
  console.error("Output must be inside the Rivet repository or system temporary directory.");
  process.exit(1);
}
if (canonicalOutput === source || canonicalOutput.startsWith(`${source}${path.sep}`) ||
    source.startsWith(`${canonicalOutput}${path.sep}`)) {
  throw new Error("Output must not overlap the canonical source.");
}
const prepared = hosts.map((host) => ({
  host, identity: sourceForHost(host.id), snapshot: readSkillSource(source, host.id),
}));

if (fs.existsSync(output)) {
  if (!force) {
    console.error(`Output already exists: ${output}`);
    console.error("Use --force to replace generated packages.");
    process.exit(1);
  }
  const information = fs.lstatSync(output);
  if (!information.isDirectory() || information.isSymbolicLink() ||
      JSON.stringify(fs.readdirSync(output).sort()) !== JSON.stringify(hosts.map((host) => host.id).sort())) {
    throw new Error("--force can replace only a complete generated host-package directory.");
  }
  for (const host of hosts) {
    const root = path.join(output, host.id);
    if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink() ||
        JSON.stringify(fs.readdirSync(root).sort()) !==
          JSON.stringify(["LICENSE", "NOTICE", "install.mjs", "rivet", "rivet-host.json"])) {
      throw new Error("The replacement target has an unexpected package inventory.");
    }
    const metadataFile = path.join(root, "rivet-host.json");
    const descriptor = fs.openSync(metadataFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let metadata;
    try {
      const metadataInfo = fs.fstatSync(descriptor);
      if (!metadataInfo.isFile() || metadataInfo.size > 65536) {
        throw new Error("The replacement target has unsafe package metadata.");
      }
      const content = Buffer.alloc(metadataInfo.size + 1);
      const bytes = fs.readSync(descriptor, content, 0, content.length, 0);
      const after = fs.fstatSync(descriptor);
      if (bytes !== metadataInfo.size || after.size !== metadataInfo.size ||
          after.mtimeMs !== metadataInfo.mtimeMs || after.ctimeMs !== metadataInfo.ctimeMs) {
        throw new Error("The replacement metadata changed during inspection.");
      }
      metadata = JSON.parse(content.subarray(0, bytes).toString("utf8"));
    } finally {
      fs.closeSync(descriptor);
    }
    if (metadata.schema !== 1 || metadata.host !== host.id) {
      throw new Error("The replacement target is not a generated Rivet package.");
    }
    readSkillSource(path.join(root, "rivet"), host.id);
  }
  fs.rmSync(output, { recursive: true });
}

for (const { host, identity, snapshot } of prepared) {
  const target = path.join(output, host.id, "rivet");
  copySnapshot(snapshot, target);
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
