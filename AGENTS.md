# AGENTS.md

This repository publishes Agent Skills (`skills/<name>/SKILL.md`) as a Claude Code plugin and through skills.sh. [CONTRIBUTING.md](./CONTRIBUTING.md) contains the complete guidelines. The rules below are the ones most likely to break distribution when missed.

- Every folder in `skills/` is published. The layout is flat (`skills/<name>/SKILL.md`), without category folders and without a `SKILL.md` at the repository root.
- Accepted frontmatter keys: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`, `disable-model-invocation`. The value of `name` matches the folder name. `description` stays at 200 characters or fewer.
- A skill with `disable-model-invocation: true` also includes `agents/openai.yaml` with `policy.allow_implicit_invocation: false`.
- Adding, renaming, or removing a skill requires updating the **Available skills** section of `README.md` and `CHANGELOG.md` in the same change.
- The version is defined only in `.claude-plugin/plugin.json`. It is not added to `marketplace.json` or as a top-level key in `SKILL.md`.
- Symbolic links are not allowed. Files use LF line endings. Scripts are written in Node.js or Python.
- `node scripts/validate.mjs` is run after any change to `skills/` or `.claude-plugin/`.
- Documentation is written in English, in a neutral and impersonal tone.
- Commit messages follow Conventional Commits and are short.
