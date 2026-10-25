import fs from "fs";
import path from "path";

export const ADAPTER_SCHEMA = 1;

function exists(cwd, file) {
  return fs.existsSync(path.join(cwd, file));
}

function readJson(cwd, file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, file), "utf8"));
  } catch {
    return null;
  }
}

function nodeRunner(cwd) {
  let directory = cwd;
  while (true) {
    if (exists(directory, "pnpm-lock.yaml")) return "pnpm";
    if (exists(directory, "yarn.lock")) return "yarn";
    if (exists(directory, "bun.lock") || exists(directory, "bun.lockb")) return "bun";
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return "npm";
}

function packageFiles(root, directory = root, depth = 0, output = []) {
  if (depth > 4) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "vendor", "target", "dist", "build"].includes(entry.name)) {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === "package.json") output.push(absolute);
    if (entry.isDirectory()) packageFiles(root, absolute, depth + 1, output);
  }
  return output;
}

export function discoverCheckAdapters(cwd) {
  const adapters = [];
  for (const packageFile of packageFiles(cwd)) {
    const directory = path.dirname(packageFile);
    const packageJson = readJson(directory, "package.json");
    if (!packageJson) continue;
    const relative = path.relative(cwd, directory) || ".";
    const runner = nodeRunner(directory);
    const scripts = packageJson.scripts || {};
    for (const baseId of ["test", "lint", "typecheck", "build"]) {
      if (!scripts[baseId]) continue;
      adapters.push({
        schema: ADAPTER_SCHEMA,
        id: relative === "." ? baseId : `${baseId}:${relative}`,
        base_id: baseId,
        ecosystem: "node",
        executable: runner,
        args: runner === "npm" ? ["run", baseId] : [baseId],
        working_directory: relative,
        source: `${relative === "." ? "package.json" : `${relative}/package.json`}#scripts.${baseId}`,
        kind: "repository-check",
      });
    }
    const intelligenceScripts = [
      ["coverage", "coverage"],
      ["test:coverage", "coverage"],
      ["mutation", "mutation"],
      ["test:mutation", "mutation"],
      ["property", "property"],
      ["test:property", "property"],
      ["contract", "contract"],
      ["test:contract", "contract"],
    ];
    for (const [scriptId, kind] of intelligenceScripts) {
      if (!scripts[scriptId]) continue;
      adapters.push({
        schema: ADAPTER_SCHEMA,
        id: relative === "." ? scriptId : `${scriptId}:${relative}`,
        base_id: scriptId,
        ecosystem: "node",
        executable: runner,
        args: runner === "npm" ? ["run", scriptId] : [scriptId],
        working_directory: relative,
        source: `${relative === "." ? "package.json" : `${relative}/package.json`}#scripts.${scriptId}`,
        kind: `${kind}-check`,
        active_target: kind === "contract",
      });
    }
  }

  if (exists(cwd, "Cargo.toml")) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "test",
      base_id: "test",
      ecosystem: "rust",
      executable: "cargo",
      args: ["test"],
      source: "Cargo.toml",
      kind: "repository-check",
    });
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "check",
      base_id: "check",
      ecosystem: "rust",
      executable: "cargo",
      args: ["check"],
      source: "Cargo.toml",
      kind: "repository-check",
    });
  }

  if (exists(cwd, "go.mod")) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "test",
      base_id: "test",
      ecosystem: "go",
      executable: "go",
      args: ["test", "./..."],
      source: "go.mod",
      kind: "repository-check",
    });
  }

  if (
    exists(cwd, "pyproject.toml") ||
    exists(cwd, "requirements.txt") ||
    exists(cwd, "setup.py")
  ) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "test",
      base_id: "test",
      ecosystem: "python",
      executable: "python3",
      args: ["-m", "pytest"],
      source: "Python project files",
      kind: "repository-check",
    });
  }

  return adapters;
}

export function discoverDependencyAdapters(cwd) {
  const adapters = [];

  if (
    exists(cwd, "package-lock.json") ||
    exists(cwd, "npm-shrinkwrap.json")
  ) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "npm-audit",
      ecosystem: "node",
      executable: "npm",
      args: ["audit", "--json"],
      source: "npm lock file",
      kind: "dependency-audit",
      network: true,
    });
  }

  if (exists(cwd, "Cargo.lock")) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "cargo-audit",
      ecosystem: "rust",
      executable: "cargo",
      args: ["audit", "--json"],
      source: "Cargo.lock",
      kind: "dependency-audit",
      network: true,
      optional_subcommand: true,
    });
  }

  if (exists(cwd, "go.mod")) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "govulncheck",
      ecosystem: "go",
      executable: "govulncheck",
      args: ["-json", "./..."],
      source: "go.mod",
      kind: "dependency-audit",
      network: true,
    });
  }

  if (
    exists(cwd, "requirements.txt") ||
    exists(cwd, "pyproject.toml")
  ) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "pip-audit",
      ecosystem: "python",
      executable: "pip-audit",
      args: ["--format", "json"],
      source: "Python dependency file",
      kind: "dependency-audit",
      network: true,
    });
  }

  return adapters;
}

