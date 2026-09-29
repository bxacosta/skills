# Skills

[![Validate](https://github.com/bxacosta/skills/actions/workflows/validate.yml/badge.svg)](https://github.com/bxacosta/skills/actions/workflows/validate.yml)
[![License](https://img.shields.io/github/license/bxacosta/skills)](./LICENSE)

A collection of skills in the [Agent Skills](https://agentskills.io) format. Each skill is a folder with a `SKILL.md` file, readable by Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, and other agents that support the format.

## Installation

Two installation routes are available. Only one should be used per environment; using both results in duplicate skills.

### Claude Code plugin

```
/plugin marketplace add bxacosta/skills
/plugin install skills@bxacosta
```

The plugin is installed as a read-only bundle and is updated when a new version is released. Skills are available under the `skills:` namespace, for example `/skills:<name>`.

### skills.sh

```bash
npx skills@latest add bxacosta/skills
```

The installer prompts for the skills and target agents, then copies the skill files into the project. Installed copies can be edited locally and are updated with `npx skills update`.

A single skill or a specific release can be installed with:

```bash
npx skills@latest add bxacosta/skills --skill <name>
npx skills@latest add bxacosta/skills#v0.1.0
```

### Manual installation

A skill folder from [`skills/`](./skills) can be copied into the skills directory of the target agent, such as `.agents/skills/` (Codex, Cursor, GitHub Copilot, Gemini CLI, and others) or `.claude/skills/` (Claude Code).

## Available skills

No skills have been published yet.

<!-- One entry per skill, linking its SKILL.md:
- [name](./skills/name/SKILL.md): short description.
-->

## Contributing

[CONTRIBUTING.md](./CONTRIBUTING.md) describes the repository layout, the requirements for each skill, and the release process.

## License

[MIT](./LICENSE)
