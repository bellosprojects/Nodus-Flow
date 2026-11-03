# Nodus agent guidance

When a user asks to inspect, create, or edit a Nodus diagram:

- Prefer the connected `nodus_*` MCP tools; do not inspect application source code to learn user-facing capabilities.
- Before a non-trivial diagram task, call `nodus_get_manual` with the relevant topic (`overview`, `nodes`, `connections`, `workflows`, or `commands`). The manual is served by the active Nodus app.
- Inspect the active project and existing nodes/connections before writing. Do not edit or delete existing content unless the user authorized it.
- After writing, list/read the affected objects and verify the result. A successful write response alone is not verification.
- Nodus access remains subject to the signed-in user's room role and visible confirmations. Never use `--yes`, `eval`, or credentials through external tools.

For code work or when no MCP connection exists, use the reference in [docs/agentes-nodus.md](../docs/agentes-nodus.md) and the [complete console manual](../docs/consola.md).
