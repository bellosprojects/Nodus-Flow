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
    actionBulkCopy,
    actionBulkFitHeight,
    actionBulkToBack,
    actionBulkToFront,
    actionSelectAll,
    actionSelectNone,
    actionInvertSelection,
    actionSelectUnconnected,
    actionDeleteSelectedNodes,
    actionDuplicateSelectedNodes,
    actionCopySelectedNodes,
    actionCutSelectedNodes,
    actionPasteNodes,
    actionChangeConnectionStyle,
    actionDeleteAllConnections,
    actionDeleteAllDisconnected,
    actionDeleteAllNodes,
    actionClearCanvas,
    actionConnectCompleteGraph,
    actionLockAllNodes,
    actionUnlockAllNodes,
} from "./actions";
import { nodusCanvas } from "./NodusCanvas";
import { connections, selectedConnectionId, setSelectedConnectionId, setConnections } from "../models/connections";
import {
    finalizeNodePosition,
    finalizeNodeSize,
    nodes,
    setNodes,
    updateNodePosition,
    updateNodeSize,
    selectedNodes,
    selectedNodesIds,
    setSelectedNodesIds
} from "../models/nodes";
import {
    updateCurrentProjectName,
    updateCurrentRoomRole,
    updateRoomId,
    updateRoomDetails,
    addCurrentProjectProperty,
    userData
} from "../models/userStore";
import { authStore } from "../models/authStore";
import { performRedo, performUndo, undoStack, redoStack } from "./history";
import { exportDiagramAsPng, exportDiagramAsSVG } from "./renderer";
import { exportAsJson } from "../models/userStore";
import { importFromQuery } from "../utils/commands";
import { evalValueFromCommand, generate } from "../utils/commands";
import { initDataFlow } from "./dataFlow";
import { activeUsers, useUser } from "../models/users";
import { addPing } from "../models/ping";
import { handleToastAction, removeToast, toasts } from "../models/toast";
import { getAutosaveHistory, restoreAutosave } from "./autosave";
import {
    isLayersPanelOpen,
    setIsLayersPanelOpen,
    isEditPanelOpen,
    setIsEditPanelOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isConfigPanelOpen,
    setIsConfigPanelOpen,
    isAutosavePanelOpen,
    setIsAutosavePAnelopen,
    layerView,
    setLayerView,
    mouseOption,
    setMouseOption,
    exportedMousePos
} from "../views/Editor/Editor";
import {
    addRoomMember,
    archiveRoom,
    deleteRoom,
    decideRoomJoinRequest,
    joinRoom,
    listRoomJoinRequests,
    listRoomActivity,
    listRoomMembers,
    listUserRooms,
    removeRoomMember,
    requestRoomAccess,
    transferRoomOwnership,
    updateRoom,
    updateRoomMemberRole,
    createRoom,
    listPublicRooms,
    type RoomVisibility
} from "../services/rooms";

export type CommandConsoleView = "lobby" | "editor";
export type AuthView = "login" | "signup";

export type ConsoleAuthPrompt =
    | { kind: "login-password"; email: string }
    | { kind: "signup-password"; email: string; nickname: string }
    | { kind: "signup-confirm"; email: string; nickname: string; password: string };

export interface CommandConsoleResult {
    ok: boolean;
    output: string;
    data?: unknown;
    clear?: boolean;
    prompt?: ConsoleAuthPrompt;
}

export interface CommandConsoleOptions {
    externalInvocation?: boolean;
    navigate?: (view: CommandConsoleView) => void;
    prepareForProjectNavigation?: () => Promise<void>;
    confirm?: (message: string) => boolean;
    getScreen?: () => string;
    setAuthView?: (view: AuthView) => void;
    login?: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signup?: (email: string, password: string, nickname: string) => Promise<{ success: boolean; error?: string }>;
    logout?: () => void;
    getLicenseStatus?: () => unknown;
    retryLicense?: () => Promise<boolean>;
    openLicenseSupport?: () => Promise<void>;
    getFullscreen?: () => Promise<boolean>;
    setFullscreen?: (value?: boolean) => Promise<boolean>;
    onHome?: () => void;
    getConsoleState?: () => unknown;
    setConsoleOpen?: (open: boolean) => void;
    setConsoleHeight?: (height: number) => void;
    recordConsoleShortcut?: () => void;
    getConsoleHistory?: () => string[];
}

interface ParsedCommand {
    words: string[];
    flags: Map<string, string | true>;
}

const HELP = `Nodus command console — commands are app commands, not shell commands.

Application
  app inspect [--json]
  app home
  app fullscreen [status|on|off|toggle]
  app ping
  auth status|view login|view signup|login <email>|signup <email> <nickname>|logout [--yes]
  license status|retry|contact
  toast list|click|dismiss <id>
  console status|open|close|toggle|resize <height>|shortcut|history
  editor status|home|fullscreen|undo|redo|run|ping
  editor panel list|open|close|toggle <properties|layers|palette|configuration|autosaves>
  editor tool list|set <select|move|connect|create>
  editor layer-view nodes|connections
  editor selection list|clear|all|invert|unconnected|select <node>...|fit-height|copy|front|back|lock|unlock|delete|duplicate
  editor clipboard copy|cut|paste|duplicate
  editor camera center|zoom <0.1..5>|pan <x> <y>
  editor share
  editor autosaves list|restore <timestamp> [--yes]
  editor export png [scale]|svg|json
  editor import json
  diagram export png [scale]|svg|json
  diagram import json

Projects
  project list|public|resume|info [--json]
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
  project activity list [--project <id>]
  project prop list|set <key> <value>|del <key> (active editor project)

Diagram data (editor; selectors are exact IDs or exact node titles)
  node list|get <selector>|create "Title"|update <selector> --name/--x/--y/--width/--height/--color/--opacity/--radius/--style/--locked
  node select|deselect <selector>|lock|unlock all|delete <selector>|all|selected|disconnected [--yes]
  node prop list <node>|set <node> <key> <value>|del <node> <key>
  connection list|get <id>|select <id>|create <from-node> <to-node>|complete|style <id> <1..7>|delete <id>|all [--yes]
  connection prop list <id>|set <id> <key> <value>|del <id> <key>
  canvas clear|reset|zoom <0.1..5>
  generate MR2ER
  eval <Heza expression>

Examples
  node create "Customer"
  node update "Customer" --name "Client" --x 160 --color "#336699"
  node prop set "Client" status active
  connection create "Client" "Order"
  project member add "ana"
  editor panel open layers
  editor export png 2
  app home
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

const requireOwnerForRoom = (roomId: string) => {
    if (roomId === userData.roomId && userData.currentRoomRole !== "owner") {
        throw new Error("Only the project owner can run this command.");
    }
};

const requireEditorScreen = (options: CommandConsoleOptions) => {
    if (options.getScreen?.() !== "editor") {
        throw new Error("This command is only available in the editor.");
    }
};

const appCommand = async (
    command: ParsedCommand,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    const [_, action, ...args] = command.words;
    const flags = command.flags;

    if (action === "inspect" || action === "status") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "app inspect [--json]");
        const screen = options.getScreen?.() || "unknown";
        const lobby = screen === "lobby"
            ? {
                ownAndJoined: await listUserRooms(),
                public: await listPublicRooms()
            }
            : undefined;
        const data = {
            screen,
            authenticated: authStore.isAuthenticated,
            user: authStore.user ? {
                id: authStore.user.id,
                email: authStore.user.email,
                nickname: authStore.user.nickname || authStore.user.display_name
            } : null,
            license: screen.startsWith("license") ? options.getLicenseStatus?.() : undefined,
            console: options.getConsoleState?.(),
            project: screen === "editor" ? {
                id: userData.roomId,
                name: userData.currentProjectName,
                role: userData.currentRoomRole,
                visibility: userData.currentRoomVisibility,
                nodes: nodes.length,
                connections: connections.length
            } : undefined,
            lobby,
            visibleControls: screen === "login"
                ? ["email", "password", "sign in", "create account"]
                : screen === "signup"
                    ? ["nickname", "email", "password", "confirm password", "create account", "login"]
                    : screen === "license"
                        ? ["license status", "retry", "support email", "device ID"]
                        : screen === "lobby"
                            ? ["resume last project", "create room", "join by ID", "your rooms", "public rooms", "account", "sign out"]
                            : screen === "editor"
                                ? userData.currentRoomRole === "viewer"
                                    ? ["project name", "collaborators", "share", "export PNG", "configuration", "canvas"]
                                    : ["project name", "collaborators", "share", "export PNG", "editor tools", "properties", "layers", "configuration", "autosaves", "canvas"]
                                : ["license validation"],
            availableCommands: screen === "editor"
                ? userData.currentRoomRole === "viewer"
                    ? ["editor status/camera/share/export", "project list/info/open/request", "node list/get/select", "connection list/get/select", "app", "auth", "toast", "console"]
                    : ["editor", "diagram", "canvas", "project", "node", "connection", "generate", "eval", "app", "auth", "toast", "console"]
                : screen === "lobby"
                    ? ["project", "app", "auth", "toast", "console"]
                    : ["auth", "license", "app", "toast", "console"]
        };
        return success(JSON.stringify(data, null, 2), data);
    }

    if (action === "home") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "app home");
        if (options.getScreen?.() === "editor") {
            options.onHome?.();
            return success("Returned to the project lobby.");
        }
        if (options.getScreen?.() === "lobby") return success("Already in the project lobby.");
        throw new Error("Home is only available from the lobby or editor.");
    }

    if (action === "ping") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "app ping");
        if (options.getScreen?.() !== "editor") throw new Error("Pings are only available in the editor.");
        const name = useUser().name();
        const color = activeUsers.find(user => user.nombre === name)?.color || "#00d4e0";
        const center = nodusCanvas.camera.getWorldCenter();
        addPing(center.x, center.y, color, name);
        return success("Ping sent at the center of the current view.");
    }

    if (action === "fullscreen") {
        checkFlags(flags, []);
        if (args.length > 1) throw new Error("Usage: app fullscreen [status|on|off|toggle]");
        const mode = args[0] || "toggle";
        if (!["status", "on", "off", "toggle"].includes(mode)) {
            throw new Error("Fullscreen mode must be status, on, off, or toggle.");
        }
        if (mode === "status") {
            if (!options.getFullscreen) throw new Error("Fullscreen state is unavailable.");
            const fullscreen = await options.getFullscreen();
            return success(fullscreen ? "Fullscreen is on." : "Fullscreen is off.", { fullscreen });
        }
        if (!options.setFullscreen) throw new Error("Fullscreen control is unavailable.");
        const fullscreen = await options.setFullscreen(mode === "toggle" ? undefined : mode === "on");
        return success(fullscreen ? "Fullscreen enabled." : "Fullscreen disabled.", { fullscreen });
    }

    throw new Error('Unknown app command. Use "help" to see available commands.');
};

const authCommand = (
    command: ParsedCommand,
    options: CommandConsoleOptions
): CommandConsoleResult => {
    const [_, action, ...args] = command.words;
    const flags = command.flags;

    if (action === "status") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "auth status");
        const data = {
            authenticated: authStore.isAuthenticated,
            loading: authStore.loading,
            user: authStore.user ? {
                id: authStore.user.id,
                email: authStore.user.email,
                nickname: authStore.user.nickname || authStore.user.display_name
            } : null,
            error: authStore.error
        };
        return success(JSON.stringify(data, null, 2), data);
    }

    if (action === "view") {
        checkFlags(flags, []);
        expectArgCount(args, 1, "auth view login|signup");
        if (authStore.isAuthenticated) throw new Error("Sign out before switching authentication screens.");
        if (args[0] !== "login" && args[0] !== "signup") {
            throw new Error("Authentication screen must be login or signup.");
        }
        if (!options.setAuthView) throw new Error("Authentication screen control is unavailable.");
        options.setAuthView(args[0]);
        return success(`Showing the ${args[0]} screen.`);
    }

    if (action === "login") {
        checkFlags(flags, []);
        expectArgCount(args, 1, "auth login <email>");
        if (authStore.isAuthenticated) throw new Error("You are already signed in.");
        required(args[0], "email");
        if (!options.login) throw new Error("Login is unavailable.");
        return {
            ok: true,
            output: "Enter the password in the masked console prompt. It will not be added to command history.",
            prompt: { kind: "login-password", email: args[0] }
        };
    }

    if (action === "signup") {
        checkFlags(flags, []);
        expectArgCount(args, 2, "auth signup <email> <nickname>");
        if (authStore.isAuthenticated) throw new Error("Sign out before creating another account.");
        required(args[0], "email");
        const nickname = required(args[1], "nickname");
        if (!/^[A-Za-z0-9_]{3,24}$/.test(nickname)) {
            throw new Error("Nickname must be 3-24 characters using letters, numbers, or underscores.");
        }
        if (!options.signup) throw new Error("Account registration is unavailable.");
        return {
            ok: true,
            output: "Enter a password (at least 6 characters) in the masked console prompt.",
            prompt: { kind: "signup-password", email: args[0], nickname }
        };
    }

    if (action === "logout") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "auth logout [--yes]");
        if (!authStore.isAuthenticated) throw new Error("You are not signed in.");
        confirmAction(options, flags, "Sign out of Nodus Flow?");
        if (!options.logout) throw new Error("Sign-out is unavailable.");
        options.logout();
        return success("Signed out.");
    }

    throw new Error('Unknown auth command. Use "help" to see available commands.');
};

export const completeConsoleAuthPrompt = async (
    prompt: ConsoleAuthPrompt,
    value: string,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    if (!value) return { ok: false, output: "Password cannot be empty." };

    if (prompt.kind === "login-password") {
        const result = await options.login?.(prompt.email, value);
        if (!result) return { ok: false, output: "Login is unavailable." };
        return result.success
            ? success("Signed in.")
            : { ok: false, output: result.error || "Login failed." };
    }

    if (prompt.kind === "signup-password") {
        if (value.length < 6) {
            return { ok: false, output: "Password must be at least 6 characters." };
        }
        return {
            ok: true,
            output: "Re-enter the password in the masked console prompt.",
            prompt: {
                kind: "signup-confirm",
                email: prompt.email,
                nickname: prompt.nickname,
                password: value
            }
        };
    }

    if (value !== prompt.password) {
        return {
            ok: false,
            output: "Passwords do not match.",
            prompt: { kind: "signup-password", email: prompt.email, nickname: prompt.nickname }
        };
    }

    const result = await options.signup?.(prompt.email, value, prompt.nickname);
    return result?.success
        ? success("Account created. Check your email to confirm it.")
        : { ok: false, output: result?.error || "Account registration failed." };
};

const licenseCommand = async (
    command: ParsedCommand,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    const [_, action, ...args] = command.words;
    checkFlags(command.flags, []);
    expectArgCount(args, 0, `license ${action || "status|retry"}`);

    if (action === "status") {
        const status = options.getLicenseStatus?.();
        if (!status) throw new Error("License status is unavailable.");
        return success(JSON.stringify(status, null, 2), status);
    }
    if (action === "retry") {
        if (!options.retryLicense) throw new Error("License validation is unavailable.");
        const valid = await options.retryLicense();
        const status = options.getLicenseStatus?.();
        return success(valid ? "License is valid." : "License is still invalid.", status);
    }
    if (action === "contact") {
        if (args.length) throw new Error("Usage: license contact");
        if (!options.openLicenseSupport) throw new Error("License support contact is unavailable.");
        await options.openLicenseSupport();
        return success("Opened the license support email.");
    }
    throw new Error('Unknown license command. Use "license status", "license retry", or "license contact".');
};

const toastCommand = async (
    command: ParsedCommand,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    const [_, action, idValue] = command.words;
    checkFlags(command.flags, []);
    if (action === "list") {
        expectArgCount(command.words.slice(1), 1, "toast list");
        const data = toasts.map(toast => ({
            id: toast.id,
            type: toast.type,
            message: toast.message,
            action: toast.onClick?.label || null
        }));
        return success(data.length ? JSON.stringify(data, null, 2) : "No active notifications.", data);
    }

    expectArgCount(command.words.slice(1), 2, `toast ${action} <id>`);
    if (action !== "click" && action !== "dismiss") {
        throw new Error('Usage: toast list|click|dismiss <id>');
    }
    const id = parseNumber(idValue, "notification ID");
    const toast = toasts.find(item => item.id === id);
    if (!toast) throw new Error(`Notification not found: ${id}`);
    if (action === "dismiss") {
        removeToast(id);
        return success(`Dismissed notification ${id}.`);
    }
    if (!toast.onClick) throw new Error("This notification has no action.");
    await handleToastAction(toast);
    return success(`Ran notification action "${toast.onClick.label}".`);
};

const consoleCommand = (
    command: ParsedCommand,
    options: CommandConsoleOptions
): CommandConsoleResult => {
    const [_, action, value] = command.words;
    checkFlags(command.flags, []);
    if (action === "status") {
        expectArgCount(command.words.slice(1), 1, "console status");
        const state = options.getConsoleState?.() ?? { available: false };
        return success(JSON.stringify(state, null, 2), state);
    }
    if (action === "history") {
        expectArgCount(command.words.slice(1), 1, "console history");
        const history = options.getConsoleHistory?.() || [];
        return success(history.length ? history.join("\n") : "No commands in history.", history);
    }
    if (action === "open" || action === "close" || action === "toggle") {
        expectArgCount(command.words.slice(1), 1, `console ${action}`);
        if (!options.setConsoleOpen) throw new Error("Console control is unavailable.");
        const state = options.getConsoleState?.() as { open?: boolean } | undefined;
        const open = action === "toggle" ? !state?.open : action === "open";
        options.setConsoleOpen(open);
        return success(open ? "Console opened." : "Console closed.", { open });
    }
    if (action === "resize") {
        expectArgCount(command.words.slice(1), 2, "console resize <height>");
        const height = parseNumber(value, "console height");
        const maximum = Math.max(180, window.innerHeight * 0.8);
        if (height < 180 || height > maximum) {
            throw new Error(`Console height must be between 180 and ${Math.floor(maximum)} pixels.`);
        }
        if (!options.setConsoleHeight) throw new Error("Console resize is unavailable.");
        options.setConsoleHeight(height);
        return success(`Console height set to ${height}px.`, { height });
    }
    if (action === "shortcut") {
        expectArgCount(command.words.slice(1), 1, "console shortcut");
        if (!options.recordConsoleShortcut) throw new Error("Console shortcut configuration is unavailable.");
        options.recordConsoleShortcut();
        return success("Press a modifier shortcut to assign it; press Escape to cancel.");
    }
    throw new Error('Usage: console status|open|close|toggle|resize <height>|shortcut|history');
};

const editorCommand = async (
    command: ParsedCommand,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    const [_, action, ...args] = command.words;
    const flags = command.flags;
    checkFlags(flags, []);
    requireProject();
    requireEditorScreen(options);

    if (action === "status") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "editor status [--json]");
        const data = {
            view: options.getScreen?.(),
            role: userData.currentRoomRole,
            project: { id: userData.roomId, name: userData.currentProjectName },
            nodes: nodes.length,
            connections: connections.length,
            projectProperties: { ...userData.currentProjectProperties },
            collaborators: activeUsers.map(user => ({
                nickname: user.nombre,
                role: user.role || null,
                object: user.object || null
            })),
            selection: selectedNodes().map(node => ({ id: node.id, title: node.title })),
            selectedConnection: connections.find(connection => connection.id === selectedConnectionId()) || null,
            tool: mouseOption(),
            layerView: layerView(),
            panels: {
                properties: isEditPanelOpen(),
                layers: isLayersPanelOpen(),
                palette: isCommandPaletteOpen(),
                configuration: isConfigPanelOpen(),
                autosaves: isAutosavePanelOpen()
            },
            camera: {
                zoom: nodusCanvas.camera.zoom(),
                offsetX: nodusCanvas.camera.offsetX(),
                offsetY: nodusCanvas.camera.offsetY(),
                cursorWorldPosition: exportedMousePos()
            },
            history: { undo: undoStack().length, redo: redoStack().length }
        };
        return success(JSON.stringify(data, null, 2), data);
    }

    if (action === "home") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "editor home");
        options.onHome?.();
        return success("Returned to the project lobby.");
    }

    if (action === "ping") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "editor ping");
        requireProject();
        const name = useUser().name();
        const color = activeUsers.find(user => user.nombre === name)?.color || "#00d4e0";
        const center = nodusCanvas.camera.getWorldCenter();
        addPing(center.x, center.y, color, name);
        return success("Ping sent at the center of the current view.");
    }

    if (action === "fullscreen") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "editor fullscreen");
        if (!options.setFullscreen) throw new Error("Fullscreen control is unavailable.");
        const fullscreen = await options.setFullscreen();
        return success(fullscreen ? "Fullscreen enabled." : "Fullscreen disabled.", { fullscreen });
    }

    if (action === "undo" || action === "redo") {
        checkFlags(flags, []);
        expectArgCount(args, 0, `editor ${action}`);
        requireEditor();
        action === "undo" ? performUndo() : performRedo();
        return success(action === "undo" ? "Undo completed." : "Redo completed.");
    }

    if (action === "run") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "editor run");
        requireEditor();
        if (!userData.currentProjectProperties.enableDataFlowMode) {
            throw new Error("Enable data-flow mode in project properties before running the simulation.");
        }
        await initDataFlow();
        return success("Data-flow simulation completed.");
    }

    if (action === "panel") {
        checkFlags(flags, []);
        const [operation, panel] = args;
        if (operation === "list") {
            expectArgCount(args, 1, "editor panel list");
            const data = {
                properties: isEditPanelOpen(),
                layers: isLayersPanelOpen(),
                palette: isCommandPaletteOpen(),
                configuration: isConfigPanelOpen(),
                autosaves: isAutosavePanelOpen()
            };
            return success(JSON.stringify(data, null, 2), data);
        }
        if (!["open", "close", "toggle"].includes(operation) || !panel) {
            throw new Error("Usage: editor panel list|open|close|toggle <properties|layers|palette|configuration|autosaves>");
        }
        const panels = {
            properties: [isEditPanelOpen, setIsEditPanelOpen],
            layers: [isLayersPanelOpen, setIsLayersPanelOpen],
            palette: [isCommandPaletteOpen, setIsCommandPaletteOpen],
            configuration: [isConfigPanelOpen, setIsConfigPanelOpen],
            autosaves: [isAutosavePanelOpen, setIsAutosavePAnelopen]
        } as const;
        if (!(panel in panels)) throw new Error(`Unknown editor panel: ${panel}`);
        if (panel !== "configuration") requireEditor();
        const [read, write] = panels[panel as keyof typeof panels];
        const next = operation === "toggle" ? !read() : operation === "open";
        write(next);
        return success(`${panel} panel ${next ? "opened" : "closed"}.`, { panel, open: next });
    }

    if (action === "autosaves") {
        if (args[0] === "list") {
            expectArgCount(args, 1, "editor autosaves list");
            const history = getAutosaveHistory()
                .sort((a, b) => b.timestamp - a.timestamp)
                .map(save => ({
                    timestamp: save.timestamp,
                    date: new Date(save.timestamp).toISOString(),
                    projectName: save.projectName,
                    nodes: save.nodes.length,
                    connections: save.connections.length
                }));
            return success(history.length ? JSON.stringify(history, null, 2) : "No autosaves for this project.", history);
        }
        if (args[0] === "restore") {
            requireEditor();
            expectArgCount(args, 2, "editor autosaves restore <timestamp> [--yes]");
            const timestamp = parseNumber(args[1], "autosave timestamp");
            const autosave = getAutosaveHistory().find(save => save.timestamp === timestamp);
            if (!autosave) throw new Error(`Autosave not found: ${timestamp}`);
            confirmAction(options, flags, `Replace the current diagram with the autosave from ${new Date(timestamp).toLocaleString()}?`);
            const restored = await restoreAutosave(autosave, data => {
                setNodes(data.nodes);
                setConnections(data.connections);
                updateCurrentProjectName(data.projectName, false);
                for (const [key, value] of Object.entries(data.projectProperties || {})) {
                    addCurrentProjectProperty(key, value);
                }
                if (data.cameraState) {
                    nodusCanvas.camera.setZoom(data.cameraState.zoom);
                    nodusCanvas.camera.setOffsetX(data.cameraState.offsetX);
                    nodusCanvas.camera.setOffsetY(data.cameraState.offsetY);
                }
            });
            if (!restored) throw new Error("Autosave was not restored.");
            return success("Autosave restored.", { timestamp });
        }
        throw new Error("Usage: editor autosaves list|restore <timestamp> [--yes]");
    }

    if (action === "tool") {
        checkFlags(flags, []);
        if (args[0] === "list") {
            expectArgCount(args, 1, "editor tool list");
            return success(`Current tool: ${mouseOption()}.`, { tool: mouseOption() });
        }
        if (args[0] !== "set" || args.length !== 2) {
            throw new Error("Usage: editor tool list|set <select|move|connect|create>");
        }
        requireEditor();
        if (!["select", "move", "connect", "create"].includes(args[1])) {
            throw new Error("Tool must be select, move, connect, or create.");
        }
        setMouseOption(args[1] as "select" | "move" | "connect" | "create");
        return success(`Active tool set to ${args[1]}.`);
    }

    if (action === "layer-view") {
        checkFlags(flags, []);
        expectArgCount(args, 1, "editor layer-view nodes|connections");
        requireEditor();
        if (args[0] !== "nodes" && args[0] !== "connections") {
            throw new Error("Layer view must be nodes or connections.");
        }
        setLayerView(args[0]);
        return success(`Layer panel is showing ${args[0]}.`);
    }

    if (action === "selection") {
        checkFlags(flags, []);
        const [operation, ...selectors] = args;
        if (operation === "list") {
            expectArgCount(args, 1, "editor selection list");
            const data = selectedNodes().map(node => ({ id: node.id, title: node.title }));
            return success(data.length ? JSON.stringify(data, null, 2) : "No nodes selected.", data);
        }
        if (operation === "clear") {
            expectArgCount(args, 1, "editor selection clear");
            actionSelectNone();
            setSelectedConnectionId(null);
            return success("Selection cleared.");
        }
        if (operation === "all" || operation === "invert" || operation === "unconnected") {
            expectArgCount(args, 1, `editor selection ${operation}`);
            if (operation === "all") actionSelectAll();
            else if (operation === "invert") actionInvertSelection();
            else actionSelectUnconnected();
            return success(`Selection ${operation} completed.`, selectedNodesIds());
        }
        if (operation === "select") {
            if (!selectors.length) throw new Error("Usage: editor selection select <node>...");
            const selected = selectors.map(findNode);
            setSelectedNodesIds([...new Set(selected.map(node => node.id))]);
            setSelectedConnectionId(null);
            return success(`Selected ${selected.length} node(s).`, selected);
        }
        if (operation === "fit-height" || operation === "copy" || operation === "front" || operation === "back" ||
            operation === "lock" || operation === "unlock" || operation === "delete" || operation === "duplicate") {
            expectArgCount(args, 1, `editor selection ${operation}`);
            requireEditor();
            if (operation === "fit-height") actionBulkFitHeight();
            if (operation === "copy") actionBulkCopy();
            if (operation === "front") actionBulkToFront();
            if (operation === "back") actionBulkToBack();
            if (operation === "lock" || operation === "unlock") {
                actionToggleLockNodes(selectedNodesIds(), operation === "lock");
            }
            if (operation === "delete") {
                confirmAction(options, flags, `Delete ${selectedNodesIds().length} selected node(s)?`);
                actionDeleteSelectedNodes();
            }
            if (operation === "duplicate") actionDuplicateSelectedNodes();
            return success(`Selection action "${operation}" completed.`);
        }
        throw new Error("Usage: editor selection list|clear|all|invert|unconnected|select|fit-height|copy|front|back|lock|unlock|delete|duplicate");
    }

    if (action === "clipboard") {
        expectArgCount(args, 1, "editor clipboard copy|cut|paste|duplicate");
        requireEditor();
        if (!["copy", "cut", "paste", "duplicate"].includes(args[0])) {
            throw new Error("Clipboard action must be copy, cut, paste, or duplicate.");
        }
        if (args[0] === "copy") actionCopySelectedNodes();
        if (args[0] === "cut") {
            confirmAction(options, flags, `Cut and remove ${selectedNodesIds().length} selected node(s)?`);
            actionCutSelectedNodes();
        }
        if (args[0] === "paste") actionPasteNodes();
        if (args[0] === "duplicate") actionDuplicateSelectedNodes();
        return success(`${args[0]} completed.`);
    }

    if (action === "camera") {
        checkFlags(flags, []);
        if (args[0] === "center") {
            expectArgCount(args, 1, "editor camera center");
            nodusCanvas.camera.centerCameraNow();
            return success("Camera centered on the diagram.");
        }
        if (args[0] === "zoom") {
            expectArgCount(args, 2, "editor camera zoom <0.1..5>");
            const zoom = parseNumber(args[1], "zoom");
            if (zoom < 0.1 || zoom > 5) throw new Error("Zoom must be between 0.1 and 5.");
            nodusCanvas.camera.setZoom(zoom);
            return success(`Zoom set to ${zoom}.`, { zoom });
        }
        if (args[0] === "pan") {
            expectArgCount(args, 3, "editor camera pan <x> <y>");
            const x = parseNumber(args[1], "camera x");
            const y = parseNumber(args[2], "camera y");
            nodusCanvas.camera.setOffsetX(x);
            nodusCanvas.camera.setOffsetY(y);
            return success("Camera position updated.", { offsetX: x, offsetY: y });
        }
        throw new Error("Usage: editor camera center|zoom <0.1..5>");
    }

    if (action === "share") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "editor share");
        const shareData: ShareData = {
            title: `Nodus Flow - ${userData.currentProjectName}`,
            text: `Join my design team at Nodus Flow!\nRoom: ${userData.currentProjectName}\nID: ${userData.roomId}`,
            url: `https://render-yqtz.onrender.com/share_diagram?d=${userData.roomId}`
        };
        const canShare = "share" in navigator && typeof navigator.share === "function";
        if (canShare) await navigator.share(shareData);
        else await navigator.clipboard.writeText(`${shareData.text}\nLink: ${shareData.url}`);
        return success(canShare ? "Project share dialog opened." : "Invitation copied to clipboard.");
    }

    if (action === "export") {
        requireArgCountForExport(args);
        const [format, scale] = args;
        if (format === "png") {
            if (scale !== undefined) {
                const parsedScale = parseNumber(scale, "scale");
                if (!Number.isInteger(parsedScale) || parsedScale < 1 || parsedScale > 10) {
                    throw new Error("PNG scale must be an integer from 1 to 10.");
                }
            }
            await exportDiagramAsPng(scale);
        }
        else if (format === "svg") await exportDiagramAsSVG();
        else if (format === "json") exportAsJson();
        else throw new Error("Export format must be png, svg, or json.");
        return success(`${format.toUpperCase()} export requested.`);
    }

    if (action === "import") {
        checkFlags(flags, []);
        expectArgCount(args, 1, "editor import json");
        requireEditor();
        if (args[0] !== "json") throw new Error("Only JSON import is supported.");
        importFromQuery();
        return success("JSON file picker opened.");
    }

    throw new Error('Unknown editor command. Use "help" to see available commands.');
};

const requireArgCountForExport = (args: string[]) => {
    if (args.length < 1 || args.length > 2) {
        throw new Error("Usage: editor export png [scale]|svg|json");
    }
    if (args[0] !== "png" && args.length > 1) {
        throw new Error("Only PNG export accepts a scale argument.");
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
    if (!["lobby", "editor"].includes(options.getScreen?.() || "")) {
        throw new Error("Project commands require an active session with a valid license.");
    }

    if (action === "resume") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "project resume");
        const roomId = userData.lastRoom;
        if (!roomId) throw new Error("There is no recently used project to resume.");
        return projectCommand({ words: ["project", "open", roomId], flags }, options);
    }

    if (action === "info") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "project info");
        requireProject();
        const data = {
            id: userData.roomId,
            name: userData.currentProjectName,
            role: userData.currentRoomRole,
            owner: {
                id: userData.currentRoomOwnerId,
                nickname: userData.currentRoomOwnerNickname
            },
            visibility: userData.currentRoomVisibility,
            properties: { ...userData.currentProjectProperties },
            membersOnline: activeUsers.map(user => ({
                nickname: user.nombre,
                role: user.role || null
            }))
        };
        return success(JSON.stringify(data, null, 2), data);
    }

    if (action === "list") {
        expectArgCount(args, 0, "project list");
        const rooms = await listUserRooms();
        return success(
            rooms.length ? rooms.map(room => `${room.name}  ${room.id}  ${room.visibility}${room.archived_at ? "  archived" : ""}`).join("\n") : "No projects found.",
            rooms
        );
    }

    if (action === "public") {
        checkFlags(flags, []);
        expectArgCount(args, 0, "project public");
        const rooms = await listPublicRooms();
        return success(
            rooms.length
                ? rooms.map(room => `${room.name}  ${room.id}  ${room.owner_nickname || "Unknown owner"}`).join("\n")
                : "No public projects found.",
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
        const roomId = activeProjectId(flags);
        requireOwnerForRoom(roomId);
        const room = await updateRoom(roomId, { name });
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
        requireOwnerForRoom(roomId);
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
        requireOwnerForRoom(id);
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
        requireOwnerForRoom(id);
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
            requireOwnerForRoom(roomId);
            const result = await listRoomMembers(roomId);
            return success(
                [
                    ...result.members.map(member => `${member.nickname || member.user_id}  ${member.role}  ${member.user_id}`),
                    ...result.banned_members.map(member => `${member.nickname || member.user_id}  blocked  ${member.user_id}`)
                ].join("\n") || "No project members.",
                result
            );
        }
        if (operation === "add") {
            requireOwnerForRoom(roomId);
            const nickname = required(memberArgs.join(" ").trim(), "member nickname");
            const member = await addRoomMember(roomId, nickname);
            return success(`Added ${member.nickname} as editor.`, member);
        }
        if (operation === "ban" || operation === "block") {
            requireOwnerForRoom(roomId);
            const target = required(memberArgs.join(" ").trim(), "member ID or nickname");
            const { members } = await listRoomMembers(roomId);
            const member = members.find(item => item.user_id === target || item.nickname === target);
            if (!member) throw new Error(`Active project member not found: ${target}`);
            confirmAction(options, flags, `Block ${member.nickname || member.user_id} from this project?`);
            const result = await removeRoomMember(roomId, member.user_id);
            return success(`Blocked ${member.nickname || member.user_id}.`, result);
        }
        if (operation === "unban" || operation === "unblock") {
            requireOwnerForRoom(roomId);
            const target = required(memberArgs.join(" ").trim(), "blocked member ID or nickname");
            const { banned_members: banned } = await listRoomMembers(roomId);
            const member = banned.find(item => item.user_id === target || item.nickname === target);
            if (!member) throw new Error(`Blocked project member not found: ${target}`);
            if (!member.nickname) throw new Error("This user has no nickname and cannot be readmitted by nickname.");
            const result = await addRoomMember(roomId, member.nickname);
            return success(`Readmitted ${member.nickname}.`, result);
        }
        if (operation === "role") {
            requireOwnerForRoom(roomId);
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
            requireOwnerForRoom(roomId);
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

    if (action === "activity") {
        checkFlags(flags, ["project"]);
        expectArgCount(args, 1, "project activity list [--project <id>]");
        if (args[0] !== "list") throw new Error("Usage: project activity list [--project <id>]");
        const activity = await listRoomActivity(activeProjectId(flags));
        return success(
            activity.length
                ? activity.map(item => `${item.created_at}  ${item.actor_nickname}  ${item.action}  ${JSON.stringify(item.details)}`).join("\n")
                : "No recent project activity.",
            activity
        );
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
            requireOwnerForRoom(roomId);
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
            requireOwnerForRoom(roomId);
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
    requireEditorScreen(options);
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
    if (action === "select" || action === "deselect") {
        expectArgCount(args, 1, `node ${action} <selector>`);
        const node = findNode(required(args[0], "node ID or title"));
        const selected = new Set(selectedNodesIds());
        if (action === "select") selected.add(node.id);
        else selected.delete(node.id);
        setSelectedNodesIds([...selected]);
        if (action === "select") setSelectedConnectionId(null);
        return success(`${action === "select" ? "Selected" : "Deselected"} node "${node.title || node.id}".`, node);
    }
    if (action === "lock" || action === "unlock") {
        requireEditor();
        expectArgCount(args, 1, `node ${action} all`);
        if (args[0] !== "all") throw new Error(`Usage: node ${action} all`);
        if (action === "lock") actionLockAllNodes();
        else actionUnlockAllNodes();
        return success(`${action === "lock" ? "Locked" : "Unlocked"} all nodes.`);
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
        if (["all", "selected", "disconnected"].includes(args[0])) {
            expectArgCount(args, 1, "node delete all|selected|disconnected [--yes]");
            const label = args[0];
            const count = label === "all"
                ? nodes.length
                : label === "selected"
                    ? selectedNodesIds().length
                    : nodes.filter(node => !connections.some(connection =>
                        connection.from === node.id || connection.to === node.id
                    )).length;
            confirmAction(options, flags, `Delete ${count} ${label} node(s)?`);
            if (label === "all") actionDeleteAllNodes();
            else if (label === "selected") actionDeleteSelectedNodes();
            else actionDeleteAllDisconnected();
            return success(`Deleted ${count} ${label} node(s).`, { deleted: count });
        }
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
    requireEditorScreen(options);
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
    if (action === "select") {
        expectArgCount(args, 1, "connection select <id>");
        const connection = findConnection(required(args[0], "connection ID"));
        setSelectedConnectionId(connection.id);
        setSelectedNodesIds([]);
        return success(`Selected connection ${connection.id}.`, connection);
    }
    if (action === "complete") {
        requireEditor();
        expectArgCount(args, 0, "connection complete");
        if (selectedNodesIds().length < 2) throw new Error("Select at least two nodes first.");
        actionConnectCompleteGraph();
        return success("Connected the selected nodes as a complete graph.");
    }
    if (action === "style") {
        requireEditor();
        expectArgCount(args, 2, "connection style <id> <1..7>");
        const connection = findConnection(required(args[0], "connection ID"));
        const style = parseNumber(args[1], "connection style");
        if (!Number.isInteger(style) || style < 1 || style > 7) {
            throw new Error("Connection style must be an integer from 1 to 7.");
        }
        actionChangeConnectionStyle(connection.id, style);
        return success(`Connection style set to ${style}.`, { id: connection.id, style });
    }
    if (action === "delete") {
        requireEditor();
        if (args[0] === "all") {
            expectArgCount(args, 1, "connection delete all [--yes]");
            confirmAction(options, flags, `Delete all ${connections.length} connections?`);
            actionDeleteAllConnections();
            return success(`Deleted all ${connections.length} connections.`);
        }
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

const canvasCommand = (
    command: ParsedCommand,
    options: CommandConsoleOptions
): CommandConsoleResult => {
    const [_, action, ...args] = command.words;
    checkFlags(command.flags, []);
    requireProject();
    requireEditorScreen(options);
    if (action === "clear") {
        expectArgCount(args, 0, "canvas clear [--yes]");
        requireEditor();
        confirmAction(options, command.flags, `Clear the canvas, deleting ${nodes.length} nodes and ${connections.length} connections?`);
        actionClearCanvas();
        return success("Canvas cleared.");
    }
    if (action === "reset" || action === "center") {
        expectArgCount(args, 0, "canvas reset");
        nodusCanvas.camera.centerCameraNow();
        return success("Camera centered on the diagram.");
    }
    if (action === "zoom") {
        expectArgCount(args, 1, "canvas zoom <0.1..5>");
        const zoom = parseNumber(args[0], "zoom");
        if (zoom < 0.1 || zoom > 5) throw new Error("Zoom must be between 0.1 and 5.");
        nodusCanvas.camera.setZoom(zoom);
        return success(`Zoom set to ${zoom}.`, { zoom });
    }
    throw new Error("Usage: canvas clear|reset|zoom <0.1..5>");
};

const execute = async (
    command: ParsedCommand,
    options: CommandConsoleOptions
): Promise<CommandConsoleResult> => {
    const [domain] = command.words;
    if (options.externalInvocation) {
        if (command.flags.has("yes")) {
            throw new Error("External integrations cannot bypass action confirmations with --yes.");
        }
        if (domain === "eval") {
            throw new Error("Heza eval is unavailable to external integrations until its interpreter can be audited.");
        }
        if (domain === "auth" && ["login", "signup"].includes(command.words[1])) {
            throw new Error("Authentication credentials cannot be supplied through external integrations.");
        }
    }
    if (!domain) return success("");
    if (domain === "help" || domain === "?" ) return success(HELP, { help: HELP });
    if (domain === "clear") {
        checkFlags(command.flags, []);
        return { ok: true, output: "", clear: true };
    }
    if (domain === "app") return appCommand(command, options);
    if (domain === "auth") return authCommand(command, options);
    if (domain === "license") return licenseCommand(command, options);
    if (domain === "toast") return toastCommand(command, options);
    if (domain === "console") return consoleCommand(command, options);
    if (domain === "editor") return editorCommand(command, options);
    if (domain === "canvas") return canvasCommand(command, options);
    if (domain === "generate") {
        checkFlags(command.flags, []);
        expectArgCount(command.words.slice(1), 1, "generate MR2ER");
        requireProject();
        requireEditor();
        requireEditorScreen(options);
        if (command.words[1] !== "MR2ER") throw new Error("Supported generator: MR2ER.");
        generate("MR2ER");
        return success("MR-to-ER generation started.");
    }
    if (domain === "eval") {
        checkFlags(command.flags, []);
        const expression = command.words.slice(1).join(" ");
        if (!expression) throw new Error("Usage: eval <Heza expression>");
        requireProject();
        requireEditor();
        requireEditorScreen(options);
        const result = await evalValueFromCommand(expression);
        if (result === "Error" || result === undefined) throw new Error("Heza evaluation failed.");
        return success(result);
    }
    if (domain === "diagram") {
        return editorCommand({ ...command, words: ["editor", ...command.words.slice(1)] }, options);
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
