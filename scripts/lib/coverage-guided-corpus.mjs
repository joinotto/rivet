import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const corpusLimits = Object.freeze({
  files: 2048,
  fileBytes: 65536,
  totalBytes: 64 * 1024 * 1024,
});

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function readCorpusFile(file, limits) {
  const descriptor = fs.openSync(
    file,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
  );
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error("A corpus entry is not a regular file.");
    if (stat.size > limits.fileBytes) {
      throw new Error(
        `A corpus entry exceeds the ${limits.fileBytes}-byte limit.`,
      );
    }
    const content = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < content.length) {
      const count = fs.readSync(
        descriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
      if (count === 0) throw new Error("A corpus entry changed while reading.");
      offset += count;
    }
    return content;
  } finally {
    fs.closeSync(descriptor);
  }
}

export function readCorpus(directory, suppliedLimits = {}) {
  const limits = { ...corpusLimits, ...suppliedLimits };
  if (!fs.existsSync(directory)) return [];
  const root = fs.lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error("The corpus root must be a non-symbolic directory.");
  }
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  if (entries.length > limits.files) {
    throw new Error(`The corpus exceeds the ${limits.files}-file limit.`);
  }

  let totalBytes = 0;
  const records = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error("The corpus can contain only regular files.");
    }
    const content = readCorpusFile(path.join(directory, entry.name), limits);
    totalBytes += content.length;
    if (totalBytes > limits.totalBytes) {
      throw new Error(
        `The corpus exceeds the ${limits.totalBytes}-byte total limit.`,
      );
    }
    records.push({
      digest: digest(content),
      content,
    });
  }
  return records;
}

export function mergeCorpus(source, destination, suppliedLimits = {}) {
  const limits = { ...corpusLimits, ...suppliedLimits };
  const destinationRecords = readCorpus(destination, limits);
  const existing = new Set(destinationRecords.map((record) => record.digest));
  let totalBytes = destinationRecords.reduce((total, record) => total + record.content.length, 0);
  const additions = [];
  for (const record of readCorpus(source, limits)) {
    if (existing.has(record.digest)) continue;
    if (destinationRecords.length + additions.length >= limits.files) {
      throw new Error(`The merged corpus exceeds the ${limits.files}-file limit.`);
    }
    totalBytes += record.content.length;
    if (totalBytes > limits.totalBytes) {
      throw new Error(`The merged corpus exceeds the ${limits.totalBytes}-byte total limit.`);
    }
    additions.push(record);
    existing.add(record.digest);
  }
  for (const record of additions) {
    fs.writeFileSync(path.join(destination, record.digest), record.content, {
      flag: "wx",
      mode: 0o600,
    });
  }
  return { added: additions.length, files: existing.size };
}

export function replaceCorpus(source, destination, suppliedLimits = {}) {
  const records = [
    ...new Map(
      readCorpus(source, suppliedLimits).map((record) => [
        record.digest,
        record,
      ]),
    ).values(),
  ];
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const record of records) {
    fs.writeFileSync(path.join(destination, record.digest), record.content, {
      flag: "wx",
      mode: 0o600,
    });
  }
  return { files: records.length };
}
