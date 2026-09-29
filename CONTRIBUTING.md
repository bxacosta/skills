# Contributing

This document describes how skills are added, changed, and released in this repository. `AGENTS.md` summarizes the same rules for coding agents.

## Distribution

The `skills/` directory is the single source of content. It is distributed through two channels:

| Channel | Audience | Files read |
|---|---|---|
| Claude Code plugin | Claude Code users who prefer managed updates | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| skills.sh (`npx skills add`) | Users of any supported agent, including Claude Code users who prefer editable copies | `skills/<name>/SKILL.md` |

Other clients reuse the same files: Codex, GitHub Copilot CLI, VS Code, Grok Build, and Factory read `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Codex treats them as a compatibility format and can install the repository as a plugin without additional manifests.

Every skill inside `skills/` is published. The plugin manifest cannot exclude a skill, because its `skills` field only adds paths to the default `skills/` scan. Unfinished skills are kept in a separate branch until they are ready.

The plugin source is the repository root (`"source": "./"`), so Claude Code copies the entire repository into its plugin cache on installation, and no exclusion mechanism exists. The repository therefore contains no private material, research, or evaluation workspaces. A `package.json` with a lockfile at the repository root would also make Claude Code run `npm ci` in the cache, so none is kept there.

## Layout

```
skills/<name>/
  SKILL.md              required: frontmatter and instructions
  references/           optional: documentation loaded on demand
  scripts/              optional: executable helpers
  assets/               optional: templates, images, data
  agents/openai.yaml    optional: Codex display metadata and invocation policy
.claude-plugin/
  plugin.json           plugin metadata; the only location of `version`
  marketplace.json      declares the repository as a plugin marketplace
AGENTS.md               instructions for coding agents working on the repository
scripts/validate.mjs    validation script used by CI
```

The layout is flat: each skill lives exactly at `skills/<name>/SKILL.md`. Category folders are not used because Codex plugins accept a single skills path and Zed does not load nested skills. Grouping, when needed, is done in the README.

## Skill requirements

### Frontmatter

Only the following keys are accepted:

| Key | Required | Rule |
|---|---|---|
| `name` | Yes | Identical to the folder name. Lowercase `a-z`, `0-9`, and single hyphens, up to 64 characters. It cannot contain `claude` or `anthropic`. |
| `description` | Yes | 1 to 1024 characters, without `<` or `>`; 200 characters or fewer is the target, since the claude.ai upload documentation sets that limit. It states what the skill does and when it applies, using the terms a user is likely to write. Agents use this text to decide when to load the skill. |
| `license` | No | `MIT`, unless the skill includes third-party material under another license. |
| `compatibility` | No | Environment requirements, up to 500 characters, for example "Requires Python 3.10+ and network access". |
| `metadata` | No | Map of string keys to string values, for example `author` or `version`. |
| `allowed-tools` | No | Experimental. Space-separated list of pre-approved tools. |
| `disable-model-invocation` | No | When `true`, the skill runs only when invoked by name. Claude Code, Cursor, VS Code, Grok Build, Factory, and Zed support it. Skills that use it cannot be uploaded to claude.ai or the Skills API. |

Client-specific keys such as `argument-hint`, `model`, `context`, `hooks`, or a top-level `version` are rejected by the validation script, since claude.ai and the Skills API refuse skills that contain them.

A skill with `disable-model-invocation: true` also includes `agents/openai.yaml`, so that Codex applies the same policy:

```yaml
interface:
  display_name: "Readable Name"
  short_description: "One line shown in the Codex skill picker"
policy:
  allow_implicit_invocation: false
```

### Naming

Names describe the task the skill performs. skills.sh installs skills from every source into the same `.agents/skills/` directory, so generic names such as `code-review` or `tdd` are avoided to prevent collisions with skills from other repositories.

### Content

- `SKILL.md` stays under 500 lines. Longer material goes into `references/`, linked with relative paths one level deep.
- Instructions do not depend on features specific to one client, such as `$ARGUMENTS`, `` !`cmd` `` injection, or `${CLAUDE_PLUGIN_ROOT}`.
- A skill that relies on another skill states it as "Call the Skill tool with `<name>`" instead of using a slash command.

### Scripts

Scripts are written in Node.js or Python so that they run on Windows as well as Unix systems. Paths are built with `path.join` or `pathlib`, files are opened with explicit `utf-8` encoding, and runtime dependencies are declared in `compatibility`.

### Files

- Symbolic links are not allowed: Codex drops them on installation and they are unreliable on Windows.
- Line endings are LF, enforced by `.gitattributes`.
- Individual assets stay under 5 MB.

## Adding a skill

1. Create a branch.
2. Create `skills/<name>/SKILL.md` according to the requirements above.
3. For a skill that only runs on explicit invocation, add `agents/openai.yaml` with `allow_implicit_invocation: false`.
4. Run the checks listed in [Local testing](#local-testing).
5. Add an entry under **Available skills** in `README.md` linking to the skill's `SKILL.md`.
6. Add an entry under `## [Unreleased]` in `CHANGELOG.md`.
7. Open a pull request, wait for CI to pass, merge, and follow the [release process](#releasing).

## Changing a skill

Changes follow the same checks and require a `CHANGELOG.md` entry. Changes to `description` affect when the skill is loaded, so the skill is tested again against prompts that should and should not trigger it.

## Renaming or removing a skill

Renaming or removing a skill is a breaking change. Plugin users lose the previous name after updating, and skills.sh users keep an outdated copy until they remove it manually. The change is recorded under **Changed** or **Removed** in `CHANGELOG.md` and released as a minor version while the project is below 1.0, and as a major version afterwards.

## Releasing

The version is defined only in `.claude-plugin/plugin.json`. Claude Code delivers updates to plugin users only when this value changes, so every release increments it. skills.sh users receive changes as soon as they reach `main`, regardless of the version.

1. Select the new version following Semantic Versioning: patch for fixes and wording changes, minor for new skills or behavior, major for removals or renames after 1.0.
2. Update `version` in `.claude-plugin/plugin.json`.
3. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and add a new empty `## [Unreleased]` section.
4. Commit with the message `chore(release): vX.Y.Z` and push to `main`.
5. Create the tag and release:

   ```bash
   gh release create vX.Y.Z --title vX.Y.Z --notes "<changelog section>"
   ```

## Local testing

```bash
node scripts/validate.mjs                                    # layout, frontmatter, and manifests (same check as CI)
claude plugin validate .claude-plugin/plugin.json --strict   # plugin manifest
claude plugin validate . --strict                            # marketplace manifest
npx skills@latest add . --list                               # skills detected by skills.sh
claude --plugin-dir .                                        # Claude Code session with the plugin loaded
```

A skill can be tested in another agent by installing it into a separate project: `npx skills@latest add <path-to-repository> --skill <name> -a codex` (or `-a cursor`, `-a '*'`).

Triggering is verified by opening a session in the target agent and writing a prompt that should use the skill without naming it, then confirming that the skill loads. A prompt that should not use the skill is tested as well.

## Deferred items

The following items are intentionally not part of the current setup. Each one is added when its condition is met.

| Item | Condition |
|---|---|
| Codex plugin installation in `README.md` (`codex plugin marketplace add bxacosta/skills`, then `codex plugin add bxacosta-skills@bxacosta`) | The installation is tested end to end in Codex. Codex already reads `.claude-plugin/`, so no additional manifest is required. |
| `.agents/plugins/marketplace.json` | Codex-specific marketplace metadata (`policy`, `interface`) is required. |
| `.cursor-plugin/plugin.json`, a root `plugin.json` ([Agent Plugins](https://agent-plugins.org)), `gemini-extension.json` | A native plugin or marketplace listing is required for that client. Each manifest adds a version field, so a script that checks version consistency is added at the same time. |
| Changesets (`package.json`, `.changeset/`, release workflow) | Releases become frequent or several contributors edit the changelog. |
| `claude plugin validate` and `skills-ref validate` in CI | Local validation proves insufficient. Both require additional tooling in CI. |
| Evaluations (`claude plugin eval`, trigger tests per skill) | Skill triggering needs to be measured, or descriptions are tuned frequently. |
| `skills.sh.json` (grouping on the skills.sh page) | The number of skills makes grouping on skills.sh useful. |
| skills.sh badge in `README.md` (`https://skills.sh/b/bxacosta/skills`) | The repository has recorded installs; before that, the badge returns "resource not found". |
| Submission to the Anthropic plugin directory (claude.ai/directory/manage) | The plugin is stable and installation without adding a marketplace is desired. |
