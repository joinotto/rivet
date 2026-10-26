#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_FRONTMATTER = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

function walk(root) {
  const files = [];
  const emptyDirectories = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const children = fs.readdirSync(absolute);
      if (!children.length) emptyDirectories.push(absolute);
      const nested = walk(absolute);
      files.push(...nested.files);
      emptyDirectories.push(...nested.emptyDirectories);
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return { files, emptyDirectories };
}

function frontmatter(source) {
  const match = source.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return { values: null, keys: [], faults: ["SKILL.md requires YAML frontmatter."] };
  const values = {};
  const keys = [];
  const faults = [];
  for (const [index, line] of match[1].split(/\r?\n/).entries()) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^[ ]*\t/.test(line)) {
      faults.push(`Frontmatter line ${index + 2} uses tab indentation.`);
      continue;
    }
    const item = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!item) continue;
    keys.push(item[1]);
    values[item[1]] = item[2].trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
  }
  return { values, keys, faults };
}

function stripFences(source) {
  const output = [];
  let fence = null;
  for (const line of source.split(/\r?\n/)) {
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (
        close &&
        close[1][0] === fence.marker &&
        close[1].length >= fence.length
      ) {
        fence = null;
      }
      output.push("");
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
      fence = { marker: open[1][0], length: open[1].length };
      output.push("");
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function anchors(source) {
  const counts = new Map();
  const result = new Set();
  for (const line of stripFences(source).split(/\r?\n/)) {
    const heading = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const base = slug(heading[1]);
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    result.add(count ? `${base}-${count}` : base);
  }
  return result;
}

function markdownLinks(source) {
  const links = [];
  const prose = stripFences(source);
  const pattern = /(?<!!)\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of prose.matchAll(pattern)) links.push(match[1]);
  return links;
}

function inside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

export function validateSkillPackage(skillDirectory) {
  const root = fs.realpathSync(path.resolve(skillDirectory));
  const faults = [];
  const warnings = [];
  const entry = path.join(root, "SKILL.md");
  if (!fs.existsSync(entry)) {
    return {
      schema: 1,
      kind: "skill-package-validation",
      skill: path.basename(root),
      faults: ["The skill package has no SKILL.md."],
      warnings,
      decision: "invalid",
    };
  }

  const entrySource = fs.readFileSync(entry, "utf8");
  const parsed = frontmatter(entrySource);
  faults.push(...parsed.faults);
  if (parsed.values) {
    if (parsed.values.name !== path.basename(root)) {
      faults.push("The frontmatter name must match the skill directory.");
    }
    if (!String(parsed.values.description || "").trim()) {
      faults.push("The frontmatter requires a description.");
    } else if (
      !/\buse (?:this )?(?:for|when|before|after|during)\b/i.test(
        parsed.values.description,
      )
    ) {
      faults.push("The description must state when the skill applies.");
    }
    for (const key of parsed.keys) {
      if (!ALLOWED_FRONTMATTER.has(key)) {
        faults.push(`Unsupported top-level frontmatter key: ${key}.`);
      }
    }
  }

  const { files, emptyDirectories } = walk(root);
  for (const directory of emptyDirectories) {
    faults.push(`Empty directory: ${path.relative(root, directory)}.`);
  }
  const markdownFiles = files.filter((file) => file.endsWith(".md"));
  const linkGraph = new Map();
  for (const file of markdownFiles) {
    const source = fs.readFileSync(file, "utf8");
    const targets = [];
    for (const rawLink of markdownLinks(source)) {
      if (
        /^(?:https?:|mailto:|tel:)/i.test(rawLink) ||
        rawLink.startsWith("#")
      ) {
        if (rawLink.startsWith("#")) {
          const anchor = decodeURIComponent(rawLink.slice(1));
          if (!anchors(source).has(anchor)) {
            faults.push(
              `${path.relative(root, file)} links to missing anchor #${anchor}.`,
            );
          }
        }
        continue;
      }
      const [rawPath, rawAnchor] = rawLink.split("#", 2);
      const decodedPath = decodeURIComponent(rawPath);
      const target = path.resolve(path.dirname(file), decodedPath);
      if (!inside(root, target)) {
        faults.push(
          `${path.relative(root, file)} links outside the skill package: ${rawLink}.`,
        );
        continue;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        faults.push(
          `${path.relative(root, file)} has a missing link target: ${rawLink}.`,
        );
        continue;
      }
      targets.push(fs.realpathSync(target));
      if (rawAnchor) {
        const targetSource = fs.readFileSync(target, "utf8");
        const anchor = decodeURIComponent(rawAnchor);
        if (!anchors(targetSource).has(anchor)) {
          faults.push(
            `${path.relative(root, file)} links to missing anchor ${rawLink}.`,
          );
        }
      }
    }
    linkGraph.set(fs.realpathSync(file), targets);
  }

  const reachable = new Set([fs.realpathSync(entry)]);
  const pending = [fs.realpathSync(entry)];
  while (pending.length) {
    const file = pending.pop();
    for (const target of linkGraph.get(file) || []) {
      if (target.endsWith(".md") && !reachable.has(target)) {
        reachable.add(target);
        pending.push(target);
      }
    }
  }
  for (const file of markdownFiles) {
    const relative = path.relative(root, file);
    if (relative.startsWith(`references${path.sep}`) && !reachable.has(fs.realpathSync(file))) {
      faults.push(`Orphan reference document: ${relative}.`);
    }
  }

  if (entrySource.split(/\r?\n/).length > 800) {
    warnings.push("SKILL.md exceeds 800 lines. Review progressive disclosure.");
  }
  return {
    schema: 1,
    kind: "skill-package-validation",
    skill: path.basename(root),
    markdown_files: markdownFiles.length,
    reference_documents: markdownFiles.filter((file) =>
      path.relative(root, file).startsWith(`references${path.sep}`),
    ).length,
    faults,
    warnings,
    decision: faults.length ? "invalid" : "valid",
  };
}

function main() {
  const target = process.argv[2] || "skills/rivet";
  const report = validateSkillPackage(target);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.faults.length) process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
