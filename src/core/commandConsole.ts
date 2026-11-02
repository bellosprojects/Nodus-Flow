import {
    actionAddProjectProperty,
    actionChangeNodeStyle,
    actionCreateConnection,
    actionCreateNode,
    actionDeleteConnection,
    actionDeleteConnectionProperty,
    actionDeleteNode,
    actionDeleteNodeProperty,
    actionDeleteProjectProperty,
    actionSetConnectionProperty,
    actionSetNodeProperty,
    actionToggleLockNodes,
    actionUpdateNodeColor,
    actionUpdateNodeOpacity,
    actionUpdateNodeRadius,
    actionUpdateNodeTitle,
    actionFinalizeNodePosition,
    actionFinalizeNodeResize,
} from "./actions";
import { nodusCanvas } from "./NodusCanvas";
import { connections } from "../models/connections";
import {
    finalizeNodePosition,
    finalizeNodeSize,
    nodes,
    updateNodePosition,
    updateNodeSize
} from "../models/nodes";
import {
    updateCurrentProjectName,
    updateCurrentRoomRole,
    updateRoomId,
    updateRoomDetails,
    userData
} from "../models/userStore";
import {
    addRoomMember,
    archiveRoom,
    deleteRoom,
    decideRoomJoinRequest,
    joinRoom,
    listRoomJoinRequests,
    listRoomMembers,
    listUserRooms,
    removeRoomMember,
    requestRoomAccess,
    transferRoomOwnership,
    updateRoom,
    updateRoomMemberRole,
    createRoom,
    type RoomVisibility
} from "../services/rooms";

export type CommandConsoleView = "lobby" | "editor";

export interface CommandConsoleResult {
    ok: boolean;
    output: string;
    data?: unknown;
    clear?: boolean;
}

export interface CommandConsoleOptions {
    navigate?: (view: CommandConsoleView) => void;
    prepareForProjectNavigation?: () => Promise<void>;
    confirm?: (message: string) => boolean;
}

interface ParsedCommand {
    words: string[];
    flags: Map<string, string | true>;
}

const HELP = `Nodus command console — commands are app commands, not shell commands.

Projects
  project list [--json]
  project create "Name" [--visibility private|shared|public]
  project open <id>
  project rename "New name" [--project <id>]
  project visibility set private|shared|public [--project <id>]
  project lock|unlock|delete <id> [--yes]
  project member list|add "nickname"|ban "member"|unban "member"
  project member role "member" editor|viewer
  project member owner transfer "member" [--yes]
  project request list|approve|reject <user-id> [--project <id>]
  project request access <id>
  project prop list|set <key> <value>|del <key> (active editor project)

Diagram data (editor; selectors are exact IDs or exact node titles)
  node list|get <selector>|create "Title"|update <selector> --name/--x/--y/--width/--height/--color/--opacity/--radius/--style/--locked
  node delete <selector> [--yes]
  node prop list <node>|set <node> <key> <value>|del <node> <key>
  connection list|get <id>|create <from-node> <to-node>|delete <id> [--yes]
  connection prop list <id>|set <id> <key> <value>|del <id> <key>

Examples
  node create "Customer"
  node update "Customer" --name "Client" --x 160 --color "#336699"
  node prop set "Client" status active
  connection create "Client" "Order"
  project member add "ana"
  help
  clear

Quote values containing spaces. Use --json for machine-readable output.
Destructive actions ask before running; use --yes only when you intend to skip that prompt.
This console does not run Bash, PowerShell, JavaScript, or arbitrary shell commands.`;

const tokenize = (input: string): string[] => {
    const tokens: string[] = [];
    let token = "";
    let quote: "'" | '"' | null = null;
    let escaping = false;
    let tokenStarted = false;

    const characters = Array.from(input);
    for (let index = 0; index < characters.length; index++) {
        const character = characters[index];
        if (escaping) {
            token += character;
            escaping = false;
            tokenStarted = true;
        } else if (character === "\\" && quote) {
            const next = characters[index + 1];
            if (next === quote || next === "\\") escaping = true;
            else token += character;
        } else if (quote) {
            if (character === quote) quote = null;
            else token += character;
            tokenStarted = true;
        } else if (character === "'" || character === '"') {
            quote = character;
            tokenStarted = true;
        } else if (/\s/.test(character)) {
            if (tokenStarted) tokens.push(token);
            token = "";
            tokenStarted = false;
        } else {
            token += character;
            tokenStarted = true;
        }
    }

    if (quote) throw new Error("Unclosed quote in command.");
    if (tokenStarted) tokens.push(token);
    return tokens;
};

const parseCommand = (input: string): ParsedCommand => {
    const tokens = tokenize(input);
    const words: string[] = [];
    const flags = new Map<string, string | true>();

    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (!token.startsWith("--")) {
            words.push(token);
            continue;
        }

        const equalsIndex = token.indexOf("=");
        const name = token.slice(2, equalsIndex < 0 ? undefined : equalsIndex);
        if (!name || flags.has(name)) throw new Error(`Invalid or repeated option: ${token}`);

        if (equalsIndex >= 0) {
            if (["json", "yes"].includes(name)) {
                throw new Error(`Option --${name} does not accept a value.`);
            }
            const value = token.slice(equalsIndex + 1);
            if (!value) throw new Error(`Option --${name} needs a value.`);
            flags.set(name, value);
        } else if (["json", "yes"].includes(name)) {
            flags.set(name, true);
        } else {
            const value = tokens[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`Option --${name} needs a value.`);
            flags.set(name, value);
            index++;
        }
    }

    return { words, flags };
};

const checkFlags = (flags: Map<string, string | true>, allowed: string[]) => {
    for (const name of flags.keys()) {
        if (!["json", "yes", ...allowed].includes(name)) {
            throw new Error(`Unknown option --${name}. Use "help" to see command usage.`);
        }
    }
};

const required = (value: string | undefined, label: string): string => {
    if (!value) throw new Error(`Missing ${label}.`);
    return value;
};

const expectArgCount = (args: string[], count: number, usage: string) => {
    if (args.length !== count) throw new Error(`Usage: ${usage}`);
};

const parseNumber = (value: string | undefined, label: string): number => {
    const parsed = Number(required(value, label));
    if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
    return parsed;
};

const parseValue = (value: string): unknown => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (value.startsWith("{") || value.startsWith("[")) {
        try {
            return JSON.parse(value);
        } catch {
            throw new Error("Object and array property values must be valid JSON.");
        }
    }
    if (value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    return value;
};

const formatResult = (
    result: CommandConsoleResult,
    json: boolean
): CommandConsoleResult => {
    if (!json) return result;
    const payload = result.ok
        ? result.data ?? { message: result.output }
        : { error: result.output };
    return { ...result, output: JSON.stringify(payload, null, 2) };
};

const success = (output: string, data?: unknown): CommandConsoleResult => ({
    ok: true,
    output,
    data
});

const requireEditor = () => {
    if (userData.currentRoomRole !== "owner" && userData.currentRoomRole !== "editor") {
        throw new Error("Open a project with editor access before running diagram commands.");
    }
};

const requireProject = () => {
    if (!userData.currentRoomRole) {
        throw new Error("Open a project before running diagram commands.");
    }
};

const findNode = (selector: string) => {
    const byId = nodes.find(node => node.id === selector);
    if (byId) return byId;
    const matches = nodes.filter(node => node.title === selector);
    if (matches.length > 1) {
        throw new Error(`More than one node is named "${selector}". Use a node ID instead.`);
    }
    if (!matches[0]) throw new Error(`Node not found: ${selector}`);
    return matches[0];
};

const findConnection = (id: string) => {
    const connection = connections.find(item => item.id === id);
    if (!connection) throw new Error(`Connection not found: ${id}`);
    return connection;
};

const activeProjectId = (flags: Map<string, string | true>) => {
    const requestedId = flags.get("project");
    if (requestedId === true) throw new Error("--project needs a project ID.");
    return requestedId || userData.roomId;
};

const notifyProjectsChanged = () => window.dispatchEvent(new Event("nodus:projects-changed"));

const confirmAction = (
    options: CommandConsoleOptions,
    flags: Map<string, string | true>,
    message: string
) => {
    if (flags.get("yes") === true) return;
    if (!options.confirm) throw new Error(`${message} Re-run with --yes to confirm explicitly.`);
    if (!options.confirm(message)) throw new Error("Cancelled.");
};

const projectCommand = async (
    command: ParsedCommand,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    const [_, action, ...args] = command.words;
    const flags = command.flags;

    if (action === "list") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "project list");
        const rooms = await listUserRooms();
        return success(
            rooms.length ? rooms.map(room => `${room.name}  ${room.id}  ${room.visibility}${room.archived_at ? "  archived" : ""}`).join("\n") : "No projects found.",
            rooms
        );
    }

    if (action === "create") {
        checkFlags(flags, ["visibility"]);
        const name = required(args.join(" ").trim(), "project name");
        const visibility = flags.get("visibility") || "shared";
        if (visibility !== "private" && visibility !== "shared" && visibility !== "public") {
            throw new Error("--visibility must be private, shared, or public.");
        }
        const room = await createRoom(name, visibility as RoomVisibility);
        await options.prepareForProjectNavigation?.();
        updateRoomId(room.id);
        updateCurrentProjectName(room.name, false);
        updateCurrentRoomRole(room.role || "owner");
        updateRoomDetails({
            owner_id: room.owner_id,
            owner_nickname: room.owner_nickname,
            visibility: room.visibility
        });
        notifyProjectsChanged();
        options.navigate?.("editor");
        return success(`Created project "${room.name}" (${room.id}).`, room);
    }

    if (action === "open") {
        checkFlags(flags, []);
        expectArgCount(args, 1, "project open <id>");
        const id = required(args[0], "project ID");
        const room = await joinRoom(id);
        await options.prepareForProjectNavigation?.();
        updateRoomId(room.id);
        updateRoomDetails({
            owner_id: room.owner_id,
            owner_nickname: room.owner_nickname,
            visibility: room.visibility
        });
        updateCurrentRoomRole(room.role || null);
        options.navigate?.("editor");
        return success(`Opened project "${room.name}" (${room.id}).`, room);
    }

    if (action === "rename") {
        checkFlags(flags, ["project"]);
        const name = required(args.join(" ").trim(), "new project name");
        const room = await updateRoom(activeProjectId(flags), { name });
        if (room.id === userData.roomId) updateCurrentProjectName(room.name, false);
        notifyProjectsChanged();
        return success(`Renamed project to "${room.name}".`, room);
    }

    if (action === "visibility") {
        checkFlags(flags, ["project"]);
        expectArgCount(args, 2, "project visibility set private|shared|public");
        if (args[0] !== "set") throw new Error("Usage: project visibility set private|shared|public");
        const visibility = required(args[1], "project visibility");
        if (visibility !== "private" && visibility !== "shared" && visibility !== "public") {
            throw new Error("Visibility must be private, shared, or public.");
        }
        const roomId = activeProjectId(flags);
        const room = await updateRoom(roomId, { visibility });
        if (room.id === userData.roomId) {
            updateRoomDetails({
                owner_id: room.owner_id,
                owner_nickname: room.owner_nickname,
                visibility: room.visibility
            });
        }
        notifyProjectsChanged();
        return success(`Project visibility set to ${room.visibility}.`, room);
    }

    if (action === "lock" || action === "unlock" || action === "archive" || action === "restore") {
        checkFlags(flags, []);
        expectArgCount(args, 1, `project ${action} <id>`);
        const id = required(args[0], "project ID");
        const locked = action === "lock" || action === "archive";
        if (locked) confirmAction(options, flags, `Archive and block access to project ${id}?`);
        const result = await archiveRoom(id, locked);
        notifyProjectsChanged();
        if (locked && id === userData.roomId) {
            await options.prepareForProjectNavigation?.();
            updateCurrentRoomRole(null);
            options.navigate?.("lobby");
        }
        return success(`Project ${id} ${locked ? "archived" : "restored"}.`, result);
    }

    if (action === "delete") {
        checkFlags(flags, []);
        expectArgCount(args, 1, "project delete <id> [--yes]");
        const id = required(args[0], "project ID");
        confirmAction(options, flags, `Permanently delete project ${id} and all its diagram data?`);
        const result = await deleteRoom(id);
        notifyProjectsChanged();
        if (id === userData.roomId) {
            await options.prepareForProjectNavigation?.();
            updateRoomId("0000000000");
            updateCurrentProjectName("", false);
            updateCurrentRoomRole(null);
            options.navigate?.("lobby");
        }
        return success(`Deleted project ${id}.`, result);
    }

    if (action === "prop" || action === "property") {
        requireProject();
        checkFlags(flags, []);
        const [operation, key, value] = args;
        if (operation === "list") {
            expectArgCount(args, 1, "project prop list");
            const properties = userData.currentProjectProperties;
            return success(
                Object.keys(properties).length
                    ? Object.entries(properties).map(([name, item]) => `${name} = ${String(item)}`).join("\n")
                    : "Project has no properties.",
                properties
            );
        }
        if (operation === "set") {
            requireEditor();
            expectArgCount(args, 3, "project prop set <key> <value>");
            const propertyName = required(key, "property name");
            const propertyValue = required(value, "property value");
            actionAddProjectProperty(propertyName, parseValue(propertyValue), userData.currentProjectProperties[propertyName]);
            return success(`Set project property "${propertyName}".`, {
                [propertyName]: userData.currentProjectProperties[propertyName]
            });
        }
        if (operation === "del" || operation === "delete") {
            requireEditor();
            expectArgCount(args, 2, "project prop del <key>");
            const propertyName = required(key, "property name");
            if (!(propertyName in userData.currentProjectProperties)) {
                throw new Error(`Project property not found: ${propertyName}`);
            }
            actionDeleteProjectProperty(propertyName, userData.currentProjectProperties[propertyName]);
            return success(`Deleted project property "${propertyName}".`);
        }
        throw new Error('Usage: project prop list|set <key> <value>|del <key>');
    }

    if (action === "member") {
        checkFlags(flags, ["project"]);
        const [operation, ...memberArgs] = args;
        const roomId = activeProjectId(flags);
        if (operation === "list") {
            expectArgCount(memberArgs, 0, "project member list");
            const result = await listRoomMembers(roomId);
            return success(
                result.members.length
                    ? result.members.map(member => `${member.nickname || member.user_id}  ${member.role}  ${member.user_id}`).join("\n")
                    : "No project members.",
                result
            );
        }
        if (operation === "add") {
            const nickname = required(memberArgs.join(" ").trim(), "member nickname");
            const member = await addRoomMember(roomId, nickname);
            return success(`Added ${member.nickname} as editor.`, member);
        }
        if (operation === "ban" || operation === "block") {
            const target = required(memberArgs.join(" ").trim(), "member ID or nickname");
            const { members } = await listRoomMembers(roomId);
            const member = members.find(item => item.user_id === target || item.nickname === target);
            if (!member) throw new Error(`Active project member not found: ${target}`);
            confirmAction(options, flags, `Block ${member.nickname || member.user_id} from this project?`);
            const result = await removeRoomMember(roomId, member.user_id);
            return success(`Blocked ${member.nickname || member.user_id}.`, result);
        }
        if (operation === "unban" || operation === "unblock") {
            const target = required(memberArgs.join(" ").trim(), "blocked member ID or nickname");
            const { banned_members: banned } = await listRoomMembers(roomId);
            const member = banned.find(item => item.user_id === target || item.nickname === target);
            if (!member) throw new Error(`Blocked project member not found: ${target}`);
            if (!member.nickname) throw new Error("This user has no nickname and cannot be readmitted by nickname.");
            const result = await addRoomMember(roomId, member.nickname);
            return success(`Readmitted ${member.nickname}.`, result);
        }
        if (operation === "role") {
            expectArgCount(memberArgs, 2, "project member role <member> editor|viewer");
            const target = required(memberArgs[0], "member ID or nickname");
            const role = required(memberArgs[1], "role");
            if (role !== "editor" && role !== "viewer") throw new Error("Role must be editor or viewer.");
            const { members } = await listRoomMembers(roomId);
            const member = members.find(item => item.user_id === target || item.nickname === target);
            if (!member) throw new Error(`Project member not found: ${target}`);
            const result = await updateRoomMemberRole(roomId, member.user_id, role);
            return success(`Changed ${member.nickname || member.user_id} role to ${role}.`, result);
        }
        if (operation === "owner") {
            if (memberArgs[0] !== "transfer") {
                throw new Error("Usage: project member owner transfer <member ID or nickname>");
            }
            const selector = memberArgs.slice(1).join(" ");
            const { members } = await listRoomMembers(roomId);
            const member = members.find(item => item.user_id === selector || item.nickname === selector);
            if (!member) throw new Error(`Project member not found: ${selector}`);
            confirmAction(options, flags, `Transfer project ownership to ${member.nickname || member.user_id}?`);
            const result = await transferRoomOwnership(roomId, member.user_id);
            if (roomId === userData.roomId) {
                updateRoomDetails({
                    owner_id: result.owner_id,
                    owner_nickname: result.owner_nickname,
                    visibility: result.visibility
                });
                updateCurrentRoomRole("editor");
            }
            return success(`Transferred project ownership to ${member.nickname || member.user_id}.`, result);
        }
        throw new Error('Usage: project member list|add|ban|unban|role|owner ...');
    }

    if (action === "request") {
        checkFlags(flags, ["project"]);
        const [operation, target] = args;
        if (operation === "access") {
            expectArgCount(args, 2, "project request access <project-id>");
            const roomId = required(target, "project ID");
            const result = await requestRoomAccess(roomId);
            return success(`Access request sent for project ${roomId}.`, result);
        }
        const roomId = activeProjectId(flags);
        if (operation === "list") {
            expectArgCount(args, 1, "project request list [--project <id>]");
            const requests = await listRoomJoinRequests(roomId);
            return success(
                requests.length
                    ? requests.map(request => `${request.nickname || request.user_id}  ${request.user_id}`).join("\n")
                    : "No pending access requests.",
                requests
            );
        }
        if (operation === "approve" || operation === "reject") {
            expectArgCount(args, 2, `project request ${operation} <user-id>`);
            const userId = required(target, "requesting user ID");
            const result = await decideRoomJoinRequest(roomId, userId, operation);
            return success(`${operation === "approve" ? "Approved" : "Rejected"} access request for ${userId}.`, result);
        }
        throw new Error("Usage: project request list|approve|reject <user-id>|access <project-id>");
    }

    throw new Error('Unknown project command. Use "help" to see available commands.');
};

const nodeCommand = (command: ParsedCommand, options: CommandConsoleOptions): CommandConsoleResult => {
    requireProject();
    const [_, action, ...args] = command.words;
    const flags = command.flags;
    checkFlags(flags, action === "update"
        ? ["name", "x", "y", "width", "height", "color", "opacity", "radius", "style", "locked"]
        : []);

    if (action === "list") {
        expectArgCount(args, 0, "node list");
        return success(
            nodes.length
                ? nodes.map(node => `${node.title || "(untitled)"}  ${node.id}  ${node.x},${node.y}`).join("\n")
                : "No nodes.",
            [...nodes]
        );
    }
    if (action === "get" || action === "show") {
        expectArgCount(args, 1, "node get <selector>");
        const node = findNode(required(args[0], "node ID or title"));
        return success(JSON.stringify(node, null, 2), node);
    }
    if (action === "create") {
        requireEditor();
        const title = required(args.join(" ").trim(), "node title");
        const center = nodusCanvas.camera.getWorldCenter();
        const node = actionCreateNode(center.x - 80, center.y - 40, title);
        if (!node) throw new Error("Node could not be created.");
        return success(`Created node "${title}" (${node.id}).`, node);
    }
    if (action === "update") {
        requireEditor();
        const node = findNode(required(args[0], "node ID or title"));
        if (args.length > 1) throw new Error("Usage: node update <selector> --field value");
        const previous = {
            title: node.title || "",
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            color: node.color,
            opacity: node.opacity,
            radius: node.radius,
            style: node.style
        };
        const updates = [...flags.keys()].filter(name => name !== "json" && name !== "yes");
        if (updates.length === 0) {
            throw new Error("Specify at least one node field to update.");
        }

        const name = flags.has("name") ? String(flags.get("name")) : undefined;
        const color = flags.has("color") ? String(flags.get("color")) : undefined;
        if (color !== undefined) {
            if (!/^#[\da-f]{3}([\da-f]{3}|[\da-f]{5})?$/i.test(color)) {
                throw new Error("Node color must be a 3, 6, or 8 digit hex color.");
            }
        }
        const opacity = flags.has("opacity")
            ? parseNumber(String(flags.get("opacity")), "opacity")
            : undefined;
        if (opacity !== undefined) {
            if (opacity < 0 || opacity > 1) throw new Error("Opacity must be between 0 and 1.");
        }
        const radius = flags.has("radius")
            ? parseNumber(String(flags.get("radius")), "radius")
            : undefined;
        if (radius !== undefined) {
            if (radius < 0) throw new Error("Radius cannot be negative.");
        }
        const style = flags.has("style")
            ? parseNumber(String(flags.get("style")), "style")
            : undefined;
        if (style !== undefined && ![1, 2, 3].includes(style)) {
            throw new Error("Style must be 1 (square), 2 (ellipse), or 3 (diamond).");
        }
        const locked = flags.get("locked");
        if (locked !== undefined && locked !== "true" && locked !== "false") {
            throw new Error("--locked must be true or false.");
        }
        const newX = flags.has("x") ? parseNumber(String(flags.get("x")), "x") : previous.x;
        const newY = flags.has("y") ? parseNumber(String(flags.get("y")), "y") : previous.y;
        const width = flags.has("width") ? parseNumber(String(flags.get("width")), "width") : previous.width;
        const height = flags.has("height") ? parseNumber(String(flags.get("height")), "height") : previous.height;
        if (width < 60 || height < 40) throw new Error("Node size must be at least 60 by 40.");

        if (name !== undefined) actionUpdateNodeTitle(node.id, previous.title, name);
        if (color !== undefined) actionUpdateNodeColor(node.id, previous.color, color);
        if (opacity !== undefined) actionUpdateNodeOpacity(node.id, previous.opacity, opacity);
        if (radius !== undefined) actionUpdateNodeRadius(node.id, previous.radius, radius);
        if (style !== undefined) actionChangeNodeStyle(node.id, previous.style, style);
        if (locked !== undefined) actionToggleLockNodes([node.id], locked === "true");
        if (flags.has("x") || flags.has("y")) {
            updateNodePosition(node.id, newX - previous.x, newY - previous.y);
            finalizeNodePosition(node.id);
            const positioned = nodes.find(item => item.id === node.id);
            if (positioned) actionFinalizeNodePosition(node.id, previous.x, previous.y, positioned.x, positioned.y);
        }

        if (flags.has("width") || flags.has("height")) {
            const current = nodes.find(item => item.id === node.id);
            if (!current) throw new Error("Node no longer exists.");
            const oldWidth = current.width;
            const oldHeight = current.height;
            const oldX = current.x;
            const oldY = current.y;
            updateNodeSize(node.id, width, height);
            finalizeNodeSize(node.id);
            actionFinalizeNodeResize(node.id, oldWidth, oldHeight, oldX, oldY);
        }

        const updated = nodes.find(item => item.id === node.id);
        return success(`Updated node ${updated?.title || node.id}.`, updated);
    }
    if (action === "delete") {
        requireEditor();
        expectArgCount(args, 1, "node delete <selector> [--yes]");
        const node = findNode(required(args[0], "node ID or title"));
        const attached = connections.filter(connection => connection.from === node.id || connection.to === node.id).length;
        confirmAction(options, flags, `Delete node "${node.title || node.id}" and its ${attached} attached connection(s)?`);
        actionDeleteNode(node.id);
        return success(`Deleted node ${node.title || node.id} and ${attached} attached connection(s).`, { id: node.id, deletedConnections: attached });
    }
    if (action === "prop" || action === "property") {
        const [operation, selector, key, value] = args;
        if (operation === "list") {
            expectArgCount(args, 2, "node prop list <node>");
            const node = findNode(required(selector, "node ID or title"));
            return success(
                Object.keys(node.properties || {}).length
                    ? Object.entries(node.properties || {}).map(([name, item]) => `${name} = ${String(item)}`).join("\n")
                    : "Node has no properties.",
                node.properties || {}
            );
        }
        const node = findNode(required(selector, "node ID or title"));
        const propertyName = required(key, "property name");
        if (operation === "set") {
            requireEditor();
            expectArgCount(args, 4, "node prop set <node> <key> <value>");
            const propertyValue = required(value, "property value");
            actionSetNodeProperty(node.id, propertyName, parseValue(propertyValue));
            return success(`Set node property "${propertyName}".`, nodes.find(item => item.id === node.id)?.properties);
        }
        if (operation === "del" || operation === "delete") {
            requireEditor();
            expectArgCount(args, 3, "node prop del <node> <key>");
            if (node.properties?.[propertyName] === undefined) {
                throw new Error(`Node property not found: ${propertyName}`);
            }
            actionDeleteNodeProperty(node.id, propertyName);
            return success(`Deleted node property "${propertyName}".`);
        }
        throw new Error("Usage: node prop list <node>|set <node> <key> <value>|del <node> <key>");
    }
    throw new Error('Unknown node command. Use "help" to see available commands.');
};

const connectionCommand = (command: ParsedCommand, options: CommandConsoleOptions): CommandConsoleResult => {
    requireProject();
    const [_, action, ...args] = command.words;
    const flags = command.flags;
    checkFlags(flags, []);

    if (action === "list") {
        expectArgCount(args, 0, "connection list");
        return success(
            connections.length
                ? connections.map(connection => {
                    const from = nodes.find(node => node.id === connection.from);
                    const to = nodes.find(node => node.id === connection.to);
                    return `${from?.title || connection.from} -> ${to?.title || connection.to}  ${connection.id}`;
                }).join("\n")
                : "No connections.",
            [...connections]
        );
    }
    if (action === "get" || action === "show") {
        expectArgCount(args, 1, "connection get <id>");
        const connection = findConnection(required(args[0], "connection ID"));
        return success(JSON.stringify(connection, null, 2), connection);
    }
    if (action === "create") {
        requireEditor();
        expectArgCount(args, 2, "connection create <from-node> <to-node>");
        const from = findNode(required(args[0], "source node ID or title"));
        const to = findNode(required(args[1], "destination node ID or title"));
        const connection = actionCreateConnection(from.id, to.id);
        if (!connection) throw new Error("Connection could not be created (the nodes may already be connected).");
        return success(`Created connection ${connection.id}.`, connection);
    }
    if (action === "delete") {
        requireEditor();
        expectArgCount(args, 1, "connection delete <id> [--yes]");
        const connection = findConnection(required(args[0], "connection ID"));
        confirmAction(options, flags, `Delete connection ${connection.id}?`);
        actionDeleteConnection(connection.id);
        return success(`Deleted connection ${connection.id}.`, { id: connection.id });
    }
    if (action === "prop" || action === "property") {
        const [operation, id, key, value] = args;
        if (operation === "list") {
            expectArgCount(args, 2, "connection prop list <id>");
            const connection = findConnection(required(id, "connection ID"));
            return success(
                Object.keys(connection.properties || {}).length
                    ? Object.entries(connection.properties || {}).map(([name, item]) => `${name} = ${String(item)}`).join("\n")
                    : "Connection has no properties.",
                connection.properties || {}
            );
        }
        const connection = findConnection(required(id, "connection ID"));
        const propertyName = required(key, "property name");
        if (operation === "set") {
            requireEditor();
            expectArgCount(args, 4, "connection prop set <id> <key> <value>");
            const propertyValue = required(value, "property value");
            actionSetConnectionProperty(connection.id, propertyName, parseValue(propertyValue));
            return success(`Set connection property "${propertyName}".`, connections.find(item => item.id === connection.id)?.properties);
        }
        if (operation === "del" || operation === "delete") {
            requireEditor();
            expectArgCount(args, 3, "connection prop del <id> <key>");
            if (connection.properties?.[propertyName] === undefined) {
                throw new Error(`Connection property not found: ${propertyName}`);
            }
            actionDeleteConnectionProperty(connection.id, propertyName);
            return success(`Deleted connection property "${propertyName}".`);
        }
        throw new Error("Usage: connection prop list <id>|set <id> <key> <value>|del <id> <key>");
    }
    throw new Error('Unknown connection command. Use "help" to see available commands.');
};

const execute = async (
    command: ParsedCommand,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    const [domain] = command.words;
    if (!domain) return success("");
    if (domain === "help" || domain === "?" ) return success(HELP, { help: HELP });
    if (domain === "clear") {
        checkFlags(command.flags, []);
        return { ok: true, output: "", clear: true };
    }
    if (domain === "project") return projectCommand(command, options);
    if (domain === "node") return nodeCommand(command, options);
    if (domain === "connection") return connectionCommand(command, options);
    throw new Error(`Unknown command "${domain}". This is not a system shell; use "help".`);
};

export const executeConsoleCommand = async (
    input: string,
    options: CommandConsoleOptions = {}
): Promise<CommandConsoleResult> => {
    try {
        const command = parseCommand(input);
        const result = await execute(command, options);
        return formatResult(result, command.flags.get("json") === true);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Command failed.";
        return { ok: false, output: message };
    }
};
