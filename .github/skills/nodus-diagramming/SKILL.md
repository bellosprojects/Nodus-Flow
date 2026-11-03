---
name: nodus-diagramming
description: "Use when planning, creating, reading, styling, or editing Nodus Flow diagrams, nodes, connections, ER models, or concept maps with MCP tools."
---

# Nodus diagramming

Use the connected Nodus MCP tools to work in the user's active application. Do not infer the available operations from source files.

## Procedure

1. Call `nodus_get_manual` with `topic: "overview"` if unfamiliar with this Nodus instance; then load the relevant `nodes`, `connections`, `workflows`, or `commands` topic before advanced work.
2. Inspect the active app/project and read the existing diagram before making changes.
3. Confirm the user's requested scope. Never silently replace, clear, or delete existing work.
4. Build using exact node IDs after creating/listing nodes; new nodes appear near the visible canvas center, so position them deliberately.
5. Use typed tools for common operations and `nodus_command` for advanced properties, connection styles, and console-only actions.
6. Re-read/list the affected objects and verify the visible result before reporting completion.
7. Respect Nodus confirmations and role restrictions. Never pass `--yes`, use `eval`, or handle account credentials through MCP.

## References

- [Full agent reference](../../../docs/agentes-nodus.md)
- [Complete Nodus console manual](../../../docs/consola.md)
