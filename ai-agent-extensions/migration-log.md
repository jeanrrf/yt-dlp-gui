# Migration log

Date: 2026-03-21

Actions performed:
- Created `ai-agent-extensions/` with subfolders: agents, prompts, skills, mcp.
- Copied root `AGENTS.md` -> `ai-agent-extensions/agents/AGENTS.md` (canonical guidance).
- Copied root `CLAUDE.md` -> `ai-agent-extensions/prompts/CLAUDE.md` (prompt/instructions for Claude).
- Added README files and a `manifest-template.json` to standardize future additions.

Additional migration actions (2026-03-21):
- Created `ai-agent-extensions/prompts/generic-assistant-guidance.md` (neutralized copy of CLAUDE.md).
- Created `ai-agent-extensions/skills/project-continue-guide.md` (normalized copy of `.continue/rules/CONTINUE.md`).
- Created `ai-agent-extensions/mcp/mcp-server-template.yaml` and `ai-agent-extensions/mcp/mcp-servers.json` (neutral MCP server templates).
- Copied `.claude/settings.local.json` to `ai-agent-extensions/configs/settings.local.json` for shared local config reference.
 - Merged MCP server entries from `.roo/mcp.json` into `ai-agent-extensions/mcp/mcp-servers.json` (added `sequentialthinking`).

Next steps recommended:
- Review other extension-specific agent/skill files and copy them into appropriate subfolders.
- Add `meta`/`manifest.json` per agent/skill/prompt.
- Optionally remove originals after verification or convert them into symlinks.
