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
  if (exists(cwd, "pnpm-lock.yaml")) return "pnpm";
  if (exists(cwd, "yarn.lock")) return "yarn";
  if (exists(cwd, "bun.lock") || exists(cwd, "bun.lockb")) return "bun";
  return "npm";
}

export function discoverCheckAdapters(cwd) {
  const adapters = [];
  const packageJson = readJson(cwd, "package.json");

  if (packageJson) {
    const runner = nodeRunner(cwd);
    const scripts = packageJson.scripts || {};
    for (const id of ["test", "lint", "typecheck", "build"]) {
      if (!scripts[id]) continue;
      adapters.push({
        schema: ADAPTER_SCHEMA,
        id,
        ecosystem: "node",
        executable: runner,
        args: runner === "npm" ? ["run", id] : [id],
        source: `package.json#scripts.${id}`,
        kind: "repository-check",
      });
    }
  }

  if (exists(cwd, "Cargo.toml")) {
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "test",
      ecosystem: "rust",
      executable: "cargo",
      args: ["test"],
      source: "Cargo.toml",
      kind: "repository-check",
    });
    adapters.push({
      schema: ADAPTER_SCHEMA,
      id: "check",
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

