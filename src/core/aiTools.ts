import {
    executeConsoleCommand,
    type CommandConsoleOptions,
    type CommandConsoleResult
} from "./commandConsole";
import { userData } from "../models/userStore";

type JsonSchema = {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
};

export interface AiToolDefinition {
    name: string;
    description: string;
    inputSchema: JsonSchema;
}

const schema = (
    properties: Record<string, unknown>,
    required: string[] = []
): JsonSchema => ({
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false
});

const stringField = (description: string) => ({ type: "string", description });
const numberField = (description: string) => ({ type: "number", description });

const commandTool: AiToolDefinition = {
    name: "nodus.command",
    description: "Run one semantic Nodus console command. Use nodus.get_manual for advanced properties, styles, or command details first. No shell, script, credential, Heza eval, or --yes confirmation bypass is accepted.",
    inputSchema: schema({
        command: stringField("A single command from the Nodus console language.")
    }, ["command"])
};

const appTools: AiToolDefinition[] = [
    {
        name: "nodus.inspect_app",
        description: "Inspect the active Nodus screen, authentication state, visible controls, and screen-level data.",
        inputSchema: schema({})
    },
    {
        name: "nodus.get_manual",
        description: "Read the built-in Nodus user and agent manual without inspecting source code. Call before planning advanced diagram tasks; select overview, commands, nodes, connections, or workflows.",
        inputSchema: schema({
            topic: {
                type: "string",
                enum: ["overview", "commands", "nodes", "connections", "workflows"],
                description: "Manual section. Defaults to overview; request a focused section for details."
            }
        })
    }
];

const projectReadTools: AiToolDefinition[] = [
    {
        name: "nodus.list_projects",
        description: "List projects available to the signed-in user.",
        inputSchema: schema({})
    }
];

const projectWriteTools: AiToolDefinition[] = [
    {
        name: "nodus.create_project",
        description: "Create a project and open it in the editor. Requires a valid signed-in session and license.",
        inputSchema: schema({
            name: stringField("Project name."),
            visibility: {
                type: "string",
                enum: ["private", "shared", "public"],
                description: "Project visibility; defaults to shared."
            }
        }, ["name"])
    },
    {
        name: "nodus.open_project",
        description: "Open a project by its exact ID.",
        inputSchema: schema({
            id: stringField("Exact project ID.")
        }, ["id"])
    }
];

const editorReadTools: AiToolDefinition[] = [
    {
        name: "nodus.inspect_diagram",
        description: "Inspect the active editor state, project properties, collaborators, selection, camera, panels, and history.",
        inputSchema: schema({})
    },
    {
        name: "nodus.list_nodes",
        description: "List nodes in the current diagram.",
        inputSchema: schema({})
    },
    {
        name: "nodus.get_node",
        description: "Read a node by exact ID or exact title. Use an ID if titles are duplicated.",
        inputSchema: schema({
            selector: stringField("Exact node ID or title.")
        }, ["selector"])
    },
    {
        name: "nodus.list_connections",
        description: "List connections in the current diagram.",
        inputSchema: schema({})
    }
];

const editorWriteTools: AiToolDefinition[] = [
    {
        name: "nodus.create_node",
        description: "Create a node at the center of the visible canvas.",
        inputSchema: schema({
            title: stringField("Node title.")
        }, ["title"])
    },
    {
        name: "nodus.update_node",
        description: "Update one or more node fields by exact ID or title.",
        inputSchema: schema({
            selector: stringField("Exact node ID or title."),
            name: stringField("New title."),
            x: numberField("New horizontal diagram coordinate."),
            y: numberField("New vertical diagram coordinate."),
            width: numberField("New width; minimum 60."),
            height: numberField("New height; minimum 40."),
            color: stringField("Hex color with 3, 6, or 8 digits."),
            opacity: numberField("Opacity from 0 to 1."),
            radius: numberField("Non-negative corner radius."),
            style: {
                type: "integer",
                enum: [1, 2, 3],
                description: "Node shape: 1 square, 2 ellipse, 3 diamond."
            },
            locked: { type: "boolean", description: "Whether the node is locked." }
        }, ["selector"])
    },
    {
        name: "nodus.delete_node",
        description: "Delete a node and its attached connections. Nodus displays a confirmation before deletion.",
        inputSchema: schema({
            selector: stringField("Exact node ID or title.")
        }, ["selector"])
    },
    {
        name: "nodus.create_connection",
        description: "Create a directed connection between two nodes by exact ID or title.",
        inputSchema: schema({
            from: stringField("Exact source node ID or title."),
            to: stringField("Exact destination node ID or title.")
        }, ["from", "to"])
    },
    {
        name: "nodus.delete_connection",
        description: "Delete a connection by ID. Nodus displays a confirmation before deletion.",
        inputSchema: schema({
            id: stringField("Exact connection ID.")
        }, ["id"])
    },
    {
        name: "nodus.export_diagram",
        description: "Export the current diagram as PNG, SVG, or JSON.",
        inputSchema: schema({
            format: {
                type: "string",
                enum: ["png", "svg", "json"],
                description: "Export format."
            },
            scale: {
                type: "integer",
                minimum: 1,
                maximum: 10,
                description: "Optional PNG scale; ignored for other formats."
            }
        }, ["format"])
    }
];

export const listAiTools = (options: CommandConsoleOptions): AiToolDefinition[] => {
    const screen = options.getScreen?.();
    const tools = [commandTool, ...appTools];

    if (screen === "lobby" || screen === "editor") {
        tools.push(...projectReadTools);
        tools.push(...projectWriteTools);
    }
    if (screen === "editor" && userData.currentRoomRole) {
        tools.push(...editorReadTools);
        if (userData.currentRoomRole === "owner" || userData.currentRoomRole === "editor") {
            tools.push(...editorWriteTools);
        }
    }
    return tools;
};

const extractManualTopic = async (topic: "overview" | "nodes" | "connections" | "workflows"): Promise<string> => {
    const { default: agentManual } = await import("../../docs/agentes-nodus.md?raw");
    const startMarker = `<!-- MCP_TOPIC:${topic}:START -->`;
    const endMarker = `<!-- MCP_TOPIC:${topic}:END -->`;
    const start = agentManual.indexOf(startMarker);
    const end = agentManual.indexOf(endMarker, start + startMarker.length);
    if (start === -1 || end === -1) {
        throw new Error(`The built-in Nodus manual section is missing: ${topic}.`);
    }
    return agentManual.slice(start + startMarker.length, end).trim();
};

const getManual = async (topic: unknown): Promise<CommandConsoleResult> => {
    const selectedTopic = topic === undefined ? "overview" : topic;
    if (typeof selectedTopic !== "string") {
        throw new Error('"topic" must be a string.');
    }
    if (selectedTopic === "commands") {
        const { default: consoleManual } = await import("../../docs/consola.md?raw");
        return { ok: true, output: consoleManual };
    }
    if (
        selectedTopic !== "overview" &&
        selectedTopic !== "nodes" &&
        selectedTopic !== "connections" &&
        selectedTopic !== "workflows"
    ) {
        throw new Error(`Unknown Nodus manual topic: ${selectedTopic}`);
    }
    return { ok: true, output: await extractManualTopic(selectedTopic) };
};

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const runCommand = (
    command: string,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => executeConsoleCommand(command, {
    ...options,
    externalInvocation: true
});

const getString = (args: Record<string, unknown>, key: string): string => {
    const value = args[key];
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`"${key}" must be a non-empty string.`);
    }
    return value;
};

const getOptionalNumber = (args: Record<string, unknown>, key: string): number | undefined => {
    const value = args[key];
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`"${key}" must be a finite number.`);
    }
    return value;
};

const validateToolArguments = (definition: AiToolDefinition, args: Record<string, unknown>) => {
    const properties = definition.inputSchema.properties;
    for (const key of Object.keys(args)) {
        if (!(key in properties)) throw new Error(`Unknown argument "${key}" for ${definition.name}.`);
    }
    for (const key of definition.inputSchema.required || []) {
        if (args[key] === undefined) throw new Error(`Missing required argument "${key}".`);
    }
    for (const [key, value] of Object.entries(args)) {
        if (value === undefined) continue;
        const property = properties[key] as {
            type?: string;
            enum?: unknown[];
            minimum?: number;
            maximum?: number;
        };
        if (property.type === "string" && typeof value !== "string") {
            throw new Error(`"${key}" must be a string.`);
        }
        if (property.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
            throw new Error(`"${key}" must be a finite number.`);
        }
        if (property.type === "integer" && (typeof value !== "number" || !Number.isInteger(value))) {
            throw new Error(`"${key}" must be an integer.`);
        }
        if (property.type === "boolean" && typeof value !== "boolean") {
            throw new Error(`"${key}" must be a boolean.`);
        }
        if (property.enum && !property.enum.includes(value)) {
            throw new Error(`"${key}" has an unsupported value.`);
        }
        if (typeof value === "number" &&
            ((property.minimum !== undefined && value < property.minimum) ||
                (property.maximum !== undefined && value > property.maximum))) {
            throw new Error(`"${key}" is outside its supported range.`);
        }
    }
};

export const callAiTool = async (
    name: string,
    input: unknown,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new Error("Tool arguments must be a JSON object.");
    }
    const args = input as Record<string, unknown>;
    const definition = listAiTools(options).find(tool => tool.name === name);
    if (!definition) {
        throw new Error(`Tool is unavailable on the current screen or for the current role: ${name}`);
    }
    validateToolArguments(definition, args);

    switch (name) {
        case "nodus.command":
            return runCommand(getString(args, "command"), options);
        case "nodus.get_manual":
            return getManual(args.topic);
        case "nodus.inspect_app":
            return runCommand("app inspect --json", options);
        case "nodus.list_projects":
            return runCommand("project list --json", options);
        case "nodus.create_project": {
            const projectName = getString(args, "name");
            const visibility = args.visibility;
            if (visibility !== undefined && !["private", "shared", "public"].includes(String(visibility))) {
                throw new Error('"visibility" must be private, shared, or public.');
            }
            const option = visibility === undefined ? "" : ` --visibility ${String(visibility)}`;
            return runCommand(`project create ${quote(projectName)}${option}`, options);
        }
        case "nodus.open_project":
            return runCommand(`project open ${quote(getString(args, "id"))}`, options);
        case "nodus.inspect_diagram":
            return runCommand("editor status --json", options);
        case "nodus.list_nodes":
            return runCommand("node list --json", options);
        case "nodus.get_node":
            return runCommand(`node get ${quote(getString(args, "selector"))} --json`, options);
        case "nodus.list_connections":
            return runCommand("connection list --json", options);
        case "nodus.create_node":
            return runCommand(`node create ${quote(getString(args, "title"))}`, options);
        case "nodus.update_node": {
            const selector = quote(getString(args, "selector"));
            const fields: Array<[string, string | number]> = [];
            for (const key of ["name", "color"] as const) {
                const value = args[key];
                if (value !== undefined) {
                    if (typeof value !== "string") throw new Error(`"${key}" must be a string.`);
                    fields.push([key, value]);
                }
            }
            for (const key of ["x", "y", "width", "height", "opacity", "radius", "style"] as const) {
                const value = getOptionalNumber(args, key);
                if (value !== undefined) fields.push([key, value]);
            }
            if (args.locked !== undefined) {
                if (typeof args.locked !== "boolean") throw new Error('"locked" must be a boolean.');
                fields.push(["locked", args.locked ? "true" : "false"]);
            }
            if (!fields.length) throw new Error("Provide at least one node field to update.");
            const flags = fields.map(([key, value]) => `--${key} ${quote(String(value))}`).join(" ");
            return runCommand(`node update ${selector} ${flags}`, options);
        }
        case "nodus.delete_node":
            return runCommand(`node delete ${quote(getString(args, "selector"))}`, options);
        case "nodus.create_connection":
            return runCommand(
                `connection create ${quote(getString(args, "from"))} ${quote(getString(args, "to"))}`,
                options
            );
        case "nodus.delete_connection":
            return runCommand(`connection delete ${quote(getString(args, "id"))}`, options);
        case "nodus.export_diagram": {
            const format = getString(args, "format");
            if (!["png", "svg", "json"].includes(format)) {
                throw new Error('"format" must be png, svg, or json.');
            }
            const scale = getOptionalNumber(args, "scale");
            if (format !== "png" && scale !== undefined) {
                throw new Error('"scale" is supported only for PNG.');
            }
            return runCommand(`editor export ${format}${scale === undefined ? "" : ` ${scale}`}`, options);
        }
        default:
            throw new Error(`Unknown Nodus tool: ${name}`);
    }
};

export const handleAiBridgeRequest = async (
    method: string,
    params: unknown,
    options: CommandConsoleOptions
) => {
    if (method === "tools/list") {
        return { tools: listAiTools(options) };
    }
    if (method !== "tools/call") {
        throw new Error(`Unsupported bridge method: ${method}`);
    }
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
        throw new Error("tools/call params must be an object.");
    }
    const call = params as { name?: unknown; arguments?: unknown };
    if (typeof call.name !== "string") throw new Error("Tool name is required.");
    if (!listAiTools(options).some(tool => tool.name === call.name)) {
        throw new Error(`Tool is unavailable on the current screen or for the current role: ${call.name}`);
    }
    const result = await callAiTool(call.name, call.arguments ?? {}, options);
    const structuredContent = result.data === undefined
        ? undefined
        : typeof result.data === "object" && result.data !== null && !Array.isArray(result.data)
            ? result.data
            : Array.isArray(result.data)
                ? { items: result.data }
                : { value: result.data };
    return {
        content: [{ type: "text", text: result.output }],
        isError: !result.ok,
        ...(structuredContent === undefined ? {} : { structuredContent })
    };
};
