import fs from "fs";
import path from "path";

const SKIP = new Set([".git", "node_modules", "vendor", "target", "dist", "build"]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function walkFor(root, target, depth = 0, output = []) {
  if (depth > 4 || !fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isFile() && entry.name === target) output.push(absolute);
    if (entry.isDirectory()) walkFor(absolute, target, depth + 1, output);
  }
  return output;
}

function componentKind(relative, manifest) {
  const text = `${relative} ${manifest.name || ""}`.toLowerCase();
  if (/(worker|consumer|job)/.test(text)) return "worker";
  if (/(api|service|server)/.test(text)) return "service";
  if (/(cli|command)/.test(text) || manifest.bin) return "cli";
  if (/(lib|package|shared|common)/.test(text)) return "library";
  return "component";
}

function packageComponents(cwd) {
  const files = walkFor(cwd, "package.json");
  const components = [];

  for (const file of files) {
    const manifest = readJson(file);
    if (!manifest) continue;
    const relative = path.relative(cwd, path.dirname(file)) || ".";
    components.push({
      id: manifest.name || `node:${relative}`,
      path: relative,
      ecosystem: "node",
      kind: componentKind(relative, manifest),
      source: path.relative(cwd, file),
      evidence_class: "observed",
      dependencies: {
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.optionalDependencies,
      },
    });
  }
  return components;
}

function fileComponent(cwd, file, ecosystem, idPattern) {
  if (!fs.existsSync(path.join(cwd, file))) return [];
  const body = fs.readFileSync(path.join(cwd, file), "utf8");
  const match = body.match(idPattern);
  return [{
    id: match?.[1] || `${ecosystem}:.`,
    path: ".",
    ecosystem,
    kind: "component",
    source: file,
    evidence_class: "observed",
    dependencies: {},
  }];
}

function dataStores(cwd) {
  const candidates = [
    ["prisma/schema.prisma", "relational-database", "Prisma schema"],
    ["drizzle.config.ts", "relational-database", "Drizzle configuration"],
    ["drizzle.config.js", "relational-database", "Drizzle configuration"],
    ["migrations", "relational-database", "Migration directory"],
    ["db/migrations", "relational-database", "Migration directory"],
  ];
  return candidates
    .filter(([file]) => fs.existsSync(path.join(cwd, file)))
    .map(([file, kind, description]) => ({
      id: file,
      kind,
      source: file,
      description,
      evidence_class: "observed",
    }));
}

function messagingSignals(components) {
  const packages = new Map([
    ["kafkajs", "kafka"],
    ["node-rdkafka", "kafka"],
    ["amqplib", "amqp"],
    ["bull", "redis-queue"],
    ["bullmq", "redis-queue"],
    ["@aws-sdk/client-sqs", "sqs"],
    ["@google-cloud/pubsub", "google-pubsub"],
  ]);
  const signals = [];
  for (const component of components) {
    for (const dependency of Object.keys(component.dependencies || {})) {
      if (!packages.has(dependency)) continue;
      signals.push({
        component: component.id,
        technology: packages.get(dependency),
        dependency,
        source: component.source,
        evidence_class: "observed",
      });
    }
  }
  return signals;
}

export function discoverTopology(cwd) {
  const components = [
    ...packageComponents(cwd),
    ...fileComponent(cwd, "Cargo.toml", "rust", /^\s*name\s*=\s*["']([^"']+)/m),
    ...fileComponent(cwd, "go.mod", "go", /^module\s+(\S+)/m),
    ...fileComponent(cwd, "pyproject.toml", "python", /^\s*name\s*=\s*["']([^"']+)/m),
  ];
  const names = new Set(components.map((item) => item.id));
  const edges = [];
  for (const component of components) {
    for (const dependency of Object.keys(component.dependencies || {})) {
      if (!names.has(dependency)) continue;
      edges.push({
        from: component.id,
        to: dependency,
        relation: "declared-dependency",
        source: component.source,
        evidence_class: "observed",
      });
    }
    delete component.dependencies;
  }

  return {
    schema: 1,
    evidence_class: "observed",
    components,
    edges,
    data_stores: dataStores(cwd),
    messaging: messagingSignals(
      packageComponents(cwd),
    ),
    limitations: [
      "Declared dependencies do not prove runtime calls.",
      "Dynamic routing and infrastructure relationships require runtime or deployment evidence.",
    ],
  };
}

export function topologyImpact(topology, files) {
  const directlyChanged = new Set();
  for (const file of files) {
    const matches = topology.components
      .filter((component) => {
        if (component.path === ".") return !topology.components.some(
          (candidate) =>
            candidate.path !== "." &&
            (file === candidate.path || file.startsWith(`${candidate.path}/`)),
        );
        return file === component.path || file.startsWith(`${component.path}/`);
      })
      .map((component) => component.id);
    for (const match of matches) directlyChanged.add(match);
  }

  const affected = new Set(directlyChanged);
  let added = true;
  while (added) {
    added = false;
    for (const edge of topology.edges) {
      if (affected.has(edge.to) && !affected.has(edge.from)) {
        affected.add(edge.from);
        added = true;
      }
    }
  }

  return {
    evidence_class: "derived",
    directly_changed: [...directlyChanged].sort(),
    affected_components: [...affected].sort(),
    propagation: topology.edges.filter(
      (edge) => affected.has(edge.from) && affected.has(edge.to),
    ),
    limitations: topology.limitations,
  };
}
