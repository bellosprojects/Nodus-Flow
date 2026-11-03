import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const endpoint = process.env.NODUS_BRIDGE_URL;
const token = process.env.NODUS_BRIDGE_TOKEN;

if (!endpoint || !token) {
    console.error("Set NODUS_BRIDGE_URL and NODUS_BRIDGE_TOKEN for the paired Nodus app.");
    process.exit(1);
}

let requestId = 0;

const callBridge = async (method, params) => {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: ++requestId,
            method,
            params
        }),
        signal: AbortSignal.timeout(125_000)
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Nodus bridge returned HTTP ${response.status}: ${detail}`);
    }

    const message = await response.json();
    if (message.error) {
        throw new Error(message.error.message || "Nodus bridge request failed.");
    }
    return message.result;
};

const toMcpToolName = name => name.replace(/^nodus\./, "nodus_");

const toBridgeToolName = name => {
    if (!name.startsWith("nodus_")) {
        throw new Error(`Unsupported Nodus MCP tool name: ${name}`);
    }
    return `nodus.${name.slice("nodus_".length)}`;
};

const server = new Server(
    { name: "nodus-flow", version: "0.1.0" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await callBridge("tools/list", {});
    return {
        ...result,
        tools: result.tools.map(tool => ({
            ...tool,
            name: toMcpToolName(tool.name)
        }))
    };
});
server.setRequestHandler(CallToolRequestSchema, request => {
    const name = toBridgeToolName(request.params.name);
    return callBridge("tools/call", {
        ...request.params,
        name
    });
});

await server.connect(new StdioServerTransport());
