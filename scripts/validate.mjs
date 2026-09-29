#!/usr/bin/env node
// Validates the repo layout, every skill's SKILL.md frontmatter, and the
// Claude plugin manifests. Zero dependencies: run with `bun scripts/validate.mjs` (Node.js also works).
// Exits 1 on any error. Warnings are printed but do not fail the run.

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(fileURLToPath(import.meta.url), "..", "..");
const skillsDir = join(repo, "skills");

// Spec fields (agentskills.io) plus `disable-model-invocation`, the one
// client extension we allow because most clients honor it.
const ALLOWED_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "disable-model-invocation",
]);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEXT_EXT = new Set([".md", ".json", ".yml", ".yaml", ".mjs", ".js", ".ts", ".py", ".sh", ".txt"]);
const IGNORED_DIRS = new Set([".git", "node_modules"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SKILL_LINES = 500;

const errors = [];
const warnings = [];
const rel = (p) => relative(repo, p).split(sep).join("/");
const error = (where, msg) => errors.push(`${rel(where)}: ${msg}`);
const warn = (where, msg) => warnings.push(`${rel(where)}: ${msg}`);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) out.push({ path: full, symlink: true });
    else if (entry.isDirectory()) walk(full, out);
    else out.push({ path: full, symlink: false });
  }
  return out;
}

// Minimal frontmatter reader for the flat YAML that SKILL.md uses: top-level
// `key: value` pairs, folded/literal block scalars (`>` / `|`), and one level
// of nested `key: value` under `metadata`.
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---(\n|$)/);
  if (!match) return null;
  const lines = match[1].split("\n");
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!top) continue;
    const [, key, rawValue] = top;
    const value = rawValue.trim();
    if (value === "" || /^[>|][+-]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === "")) {
        block.push(lines[++i]);
      }
      if (value === "") {
        const map = {};
        for (const b of block) {
          const kv = b.match(/^\s+([A-Za-z0-9_.-]+):\s*(.*)$/);
          if (kv) map[kv[1]] = unquote(kv[2].trim());
        }
        data[key] = map;
      } else {
        const joiner = value.startsWith(">") ? " " : "\n";
        data[key] = block.map((b) => b.trim()).filter(Boolean).join(joiner);
      }
    } else {
      data[key] = unquote(value);
    }
  }
  return data;
}

function unquote(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    error(path, `invalid JSON (${e.message})`);
    return null;
  }
}

// 1. Repo-wide file checks.
const files = walk(repo);
for (const f of files) {
  if (f.symlink) {
    error(f.path, "symlinks are not allowed (Codex drops them and they break on Windows)");
    continue;
  }
  const ext = f.path.slice(f.path.lastIndexOf(".")).toLowerCase();
  const size = lstatSync(f.path).size;
  if (size > MAX_FILE_BYTES) warn(f.path, `file is ${(size / 1024 / 1024).toFixed(1)} MB (keep assets under 5 MB)`);
  if (TEXT_EXT.has(ext) && readFileSync(f.path, "utf8").includes("\r\n")) {
    error(f.path, "CRLF line endings (use LF; see .gitattributes)");
  }
}

if (existsSync(join(repo, "SKILL.md"))) {
  error(join(repo, "SKILL.md"), "no SKILL.md at the repo root: installers would see only that one skill");
}

// 2. Skills.
const skillNames = [];
if (existsSync(skillsDir)) {
  for (const f of files) {
    if (!f.path.endsWith(`${sep}SKILL.md`)) continue;
    const parts = rel(f.path).split("/");
    if (!(parts.length === 3 && parts[0] === "skills")) {
      if (rel(f.path) !== "SKILL.md") error(f.path, "SKILL.md must live at skills/<name>/SKILL.md (flat layout)");
    }
  }

  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(skillsDir, entry.name);
    const skillMd = join(dir, "SKILL.md");
    if (!existsSync(skillMd)) {
      error(dir, "skill folder has no SKILL.md");
      continue;
    }
    const text = readFileSync(skillMd, "utf8");
    const fm = parseFrontmatter(text.replace(/\r\n/g, "\n"));
    if (!fm) {
      error(skillMd, "missing YAML frontmatter (--- ... ---) at the top of the file");
      continue;
    }

    for (const key of Object.keys(fm)) {
      if (!ALLOWED_KEYS.has(key)) {
        error(skillMd, `frontmatter key "${key}" is not allowed (allowed: ${[...ALLOWED_KEYS].join(", ")})`);
      }
    }

    const { name, description, compatibility, metadata } = fm;
    if (typeof name !== "string" || !name) error(skillMd, "`name` is required");
    else {
      if (name.length > 64) error(skillMd, "`name` must be 64 characters or fewer");
      if (!NAME_RE.test(name)) error(skillMd, "`name` must be lowercase a-z, 0-9 and single hyphens, not starting or ending with a hyphen");
      if (name !== entry.name) error(skillMd, `\`name\` ("${name}") must match its folder name ("${entry.name}")`);
      if (/claude|anthropic/.test(name)) error(skillMd, '`name` must not contain "claude" or "anthropic" (rejected by claude.ai and the Skills API)');
      skillNames.push(name);
    }

    if (typeof description !== "string" || !description.trim()) error(skillMd, "`description` is required");
    else {
      if (description.length > 1024) error(skillMd, `\`description\` is ${description.length} characters (max 1024)`);
      else if (description.length > 200) warn(skillMd, `\`description\` is ${description.length} characters (claude.ai uploads accept 200)`);
      if (/[<>]/.test(description)) error(skillMd, "`description` must not contain XML tags or angle brackets");
    }

    if (compatibility !== undefined && String(compatibility).length > 500) error(skillMd, "`compatibility` must be 500 characters or fewer");
    if (metadata !== undefined && (typeof metadata !== "object" || metadata === null)) error(skillMd, "`metadata` must be a map of string keys to string values");
    if (fm["disable-model-invocation"] !== undefined) {
      warn(skillMd, "`disable-model-invocation` blocks uploading this skill to claude.ai and the Skills API");
      if (fm["disable-model-invocation"] === true) {
        const openai = join(dir, "agents", "openai.yaml");
        const ok = existsSync(openai) && /allow_implicit_invocation:\s*false/.test(readFileSync(openai, "utf8"));
        if (!ok) warn(skillMd, "user-invoked skill: add agents/openai.yaml with `policy: { allow_implicit_invocation: false }` so Codex matches");
      }
    }

    const lineCount = text.split("\n").length;
    if (lineCount > MAX_SKILL_LINES) warn(skillMd, `${lineCount} lines (keep SKILL.md under ${MAX_SKILL_LINES}; move detail into references/)`);
  }
}

// 3. Claude plugin manifests.
const pluginPath = join(repo, ".claude-plugin", "plugin.json");
const marketplacePath = join(repo, ".claude-plugin", "marketplace.json");
const plugin = existsSync(pluginPath) ? readJson(pluginPath) : (error(pluginPath, "missing"), null);
const marketplace = existsSync(marketplacePath) ? readJson(marketplacePath) : (error(marketplacePath, "missing"), null);

if (plugin) {
  if (!plugin.name || !NAME_RE.test(plugin.name)) error(pluginPath, "`name` is required and must be kebab-case");
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(plugin.version ?? "")) error(pluginPath, "`version` must be semver (X.Y.Z)");
  if ("skills" in plugin) warn(pluginPath, "`skills` only ADDS paths to the default skills/ scan; it cannot exclude skills");
}
if (marketplace && plugin) {
  const entries = marketplace.plugins ?? [];
  const entry = entries.find((p) => p.name === plugin.name);
  if (!entry) error(marketplacePath, `no plugins[] entry named "${plugin.name}" (must match plugin.json)`);
  else if (entry.source !== "./") error(marketplacePath, `plugin "${plugin.name}" must use "source": "./"`);
  if (entry && "version" in entry) warn(marketplacePath, "drop `version` from the marketplace entry; plugin.json is the single source of truth");
}

const dupes = skillNames.filter((n, i) => skillNames.indexOf(n) !== i);
for (const d of new Set(dupes)) errors.push(`skills/: duplicate skill name "${d}"`);

// Report.
for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
console.log(`\n${skillNames.length} skill(s) checked: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
