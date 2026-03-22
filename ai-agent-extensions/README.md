# ai-agent-extensions

Centralized folder for agent-related assets (agents, prompts, skills, MCP) used across providers and extensions.

Structure
- agents/: Agent manifests, AGENTS.md guidance files
- skills/: SKILL.md files and skill templates
- prompts/: Prompt files and variants (CLAUDE, GPT, etc.)
- mcp/: MCP server definitions and helpers
- migration-log.md: record of initial migration actions

Usage
- Keep canonical copies here. Extensions/providers may reference or extend these files.
- Add `meta.json` or `manifest.json` to each agent/skill/prompt folder describing `provider`, `compatibility`, and `version`.

Migration note
Initial migration copied root `AGENTS.md` to `agents/AGENTS.md` and `CLAUDE.md` to `prompts/CLAUDE.md`. See `migration-log.md` for details.
