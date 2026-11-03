import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
    executeConsoleCommand,
    completeConsoleAuthPrompt,
    type CommandConsoleOptions,
    type ConsoleAuthPrompt
} from "../core/commandConsole";
import { handleAiBridgeRequest } from "../core/aiTools";
import styles from "./CommandConsole.module.css";

type ConsoleEntry = {
    id: number;
    kind: "command" | "success" | "error";
    text: string;
};

type ConsoleShortcut = {
    code: string;
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;
};

type BridgeStatus = {
    enabled: boolean;
    endpoint: string;
};

type BridgeClient = {
    id: string;
    name: string;
    createdAt: number;
};

type BridgeRequest = {
    requestId: string;
    clientId: string;
    clientName: string;
    method: string;
    params: unknown;
};

type AiClientTarget = "vscode" | "claude" | "cursor";

type AiClientSetup = {
    configPath: string;
    backupPath: string | null;
};

type AiClientTargetInfo = {
    id: AiClientTarget;
    label: string;
    detected: boolean;
};

const DEFAULT_AI_CLIENT_TARGETS: AiClientTargetInfo[] = [
    { id: "vscode", label: "VS Code / Copilot", detected: false },
    { id: "claude", label: "Claude Desktop", detected: false },
    { id: "cursor", label: "Cursor", detected: false }
];

const HISTORY_LIMIT = 100;
const loadPanelHeight = () => {
    const stored = Number(localStorage.getItem("nodus_console_height"));
    return Number.isFinite(stored) && stored >= 180
        ? Math.min(stored, Math.max(220, window.innerHeight * 0.8))
        : Math.min(Math.max(220, window.innerHeight * 0.38), 360);
};

const DEFAULT_SHORTCUT: ConsoleShortcut = {
    code: "Backquote",
    ctrl: true,
    meta: false,
    alt: false,
    shift: false
};

const loadShortcut = (): ConsoleShortcut => {
    const stored = localStorage.getItem("nodus_console_shortcut");
    if (!stored) return DEFAULT_SHORTCUT;

    try {
        const value: unknown = JSON.parse(stored);
        if (
            typeof value === "object" &&
            value !== null &&
            "code" in value &&
            typeof value.code === "string" &&
            value.code.length > 0 &&
            "ctrl" in value &&
            typeof value.ctrl === "boolean" &&
            "meta" in value &&
            typeof value.meta === "boolean" &&
            "alt" in value &&
            typeof value.alt === "boolean" &&
            "shift" in value &&
            typeof value.shift === "boolean"
        ) {
            return {
                code: value.code,
                ctrl: value.ctrl,
                meta: value.meta,
                alt: value.alt,
                shift: value.shift
            };
        }
        console.error("Stored command-console shortcut is invalid; using the default shortcut.");
    } catch (error) {
        console.error("Could not read the stored command-console shortcut.", error);
    }
    return DEFAULT_SHORTCUT;
};

export const CommandConsole = (props: { options: CommandConsoleOptions }) => {
    const [isOpen, setIsOpen] = createSignal(false);
    const [input, setInput] = createSignal("");
    const [entries, setEntries] = createSignal<ConsoleEntry[]>([
        { id: 0, kind: "success", text: 'Nodus command console. Type "help" to see commands.' }
    ]);
    const [history, setHistory] = createSignal<string[]>([]);
    const [historyIndex, setHistoryIndex] = createSignal(-1);
    const [isRunning, setIsRunning] = createSignal(false);
    const [authPrompt, setAuthPrompt] = createSignal<ConsoleAuthPrompt | null>(null);
    const [panelHeight, setPanelHeight] = createSignal(loadPanelHeight());
    const [shortcut, setShortcut] = createSignal(loadShortcut());
    const [isRecordingShortcut, setIsRecordingShortcut] = createSignal(false);
    const [showAiAccess, setShowAiAccess] = createSignal(false);
    const [bridgeStatus, setBridgeStatus] = createSignal<BridgeStatus | null>(null);
    const [bridgeClients, setBridgeClients] = createSignal<BridgeClient[]>([]);
    const [bridgeTargets, setBridgeTargets] = createSignal(DEFAULT_AI_CLIENT_TARGETS);
    const [bridgeClientName, setBridgeClientName] = createSignal("AI client");
    const [bridgeSetupTarget, setBridgeSetupTarget] = createSignal<AiClientTarget>("vscode");
    const [newBridgeToken, setNewBridgeToken] = createSignal("");
    const [bridgeError, setBridgeError] = createSignal("");
    const [bridgeNotice, setBridgeNotice] = createSignal("");
    const [bridgeBusy, setBridgeBusy] = createSignal(false);
    let nextEntryId = 1;
    let inputRef: HTMLInputElement | undefined;
    let outputRef: HTMLDivElement | undefined;
    let unlistenBridge: (() => void) | undefined;
    let bridgeListenerDisposed = false;
    let resizeStartY = 0;
    let resizeStartHeight = 0;

    const matchesShortcut = (event: KeyboardEvent, value: ConsoleShortcut) =>
        event.code === value.code &&
        event.ctrlKey === value.ctrl &&
        event.metaKey === value.meta &&
        event.altKey === value.alt &&
        event.shiftKey === value.shift;

    const shortcutLabel = () => {
        const value = shortcut();
        const parts = [];
        if (value.ctrl) parts.push("Ctrl");
        if (value.meta) parts.push("Meta");
        if (value.alt) parts.push("Alt");
        if (value.shift) parts.push("Shift");
        parts.push(value.code === "Backquote" ? "`" : value.code.replace(/^(Key|Digit)/, ""));
        return parts.join("+");
    };

    const resizePanel = (event: PointerEvent) => {
        const maximum = Math.max(180, window.innerHeight * 0.8);
        const height = Math.min(maximum, Math.max(180, resizeStartHeight + resizeStartY - event.clientY));
        setPanelHeight(height);
    };

    const stopResizing = () => {
        window.removeEventListener("pointermove", resizePanel);
        window.removeEventListener("pointerup", stopResizing);
        window.removeEventListener("pointercancel", stopResizing);
        localStorage.setItem("nodus_console_height", String(panelHeight()));
    };

    const startResizing = (event: PointerEvent) => {
        event.preventDefault();
        resizeStartY = event.clientY;
        resizeStartHeight = panelHeight();
        window.addEventListener("pointermove", resizePanel);
        window.addEventListener("pointerup", stopResizing);
        window.addEventListener("pointercancel", stopResizing);
    };

    const append = (kind: ConsoleEntry["kind"], text: string) => {
        setEntries(previous => [...previous, { id: nextEntryId++, kind, text }].slice(-HISTORY_LIMIT));
    };

    const getConsoleState = () => ({
            open: isOpen(),
            height: panelHeight(),
            shortcut: shortcutLabel(),
            recordingShortcut: isRecordingShortcut()
        });

    const commandOptions = (): CommandConsoleOptions => ({
        ...props.options,
        getConsoleState,
        getConsoleHistory: () => history(),
        setConsoleOpen: open => setIsOpen(open),
        setConsoleHeight: height => {
            setPanelHeight(height);
            localStorage.setItem("nodus_console_height", String(height));
        },
        recordConsoleShortcut: () => setIsRecordingShortcut(true)
    });

    const refreshBridgeState = async () => {
        if (!isTauri()) {
            setBridgeError("AI integration is available only in the native Tauri app.");
            return;
        }
        try {
            const [status, clients, targets] = await Promise.all([
                invoke<BridgeStatus>("get_ai_bridge_status"),
                invoke<BridgeClient[]>("list_ai_bridge_clients"),
                invoke<AiClientTargetInfo[]>("list_ai_client_targets")
            ]);
            setBridgeStatus(status);
            setBridgeClients(clients);
            setBridgeTargets(targets);
            setBridgeError("");
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        }
    };

    const startBridge = async () => {
        setBridgeBusy(true);
        try {
            const status = await invoke<BridgeStatus>("start_ai_bridge");
            setBridgeStatus(status);
            setBridgeError("");
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        } finally {
            setBridgeBusy(false);
        }
    };

    const stopBridge = async () => {
        setBridgeBusy(true);
        try {
            const status = await invoke<BridgeStatus>("stop_ai_bridge");
            setBridgeStatus(status);
            setBridgeError("");
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        } finally {
            setBridgeBusy(false);
        }
    };

    const pairBridgeClient = async () => {
        const name = bridgeClientName().trim();
        if (!name) {
            setBridgeError("Enter a name for this AI client.");
            return;
        }
        setBridgeBusy(true);
        try {
            const result = await invoke<{ client: BridgeClient; token: string }>(
                "pair_ai_bridge_client",
                { name }
            );
            setNewBridgeToken(result.token);
            await refreshBridgeState();
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        } finally {
            setBridgeBusy(false);
        }
    };

    const revokeBridgeClient = async (client: BridgeClient) => {
        if (!window.confirm(`Revoke access for "${client.name}"?`)) return;
        setBridgeBusy(true);
        try {
            await invoke("revoke_ai_bridge_client", { clientId: client.id });
            setNewBridgeToken("");
            await refreshBridgeState();
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        } finally {
            setBridgeBusy(false);
        }
    };

    const clientTargetLabel = (target: AiClientTarget) =>
        bridgeTargets().find(item => item.id === target)?.label ?? ({
            vscode: "VS Code / Copilot",
            claude: "Claude Desktop",
            cursor: "Cursor"
        })[target];

    const configureBridgeClient = async (client: BridgeClient) => {
        const target = bridgeSetupTarget();
        const targetInfo = bridgeTargets().find(item => item.id === target);
        if (!window.confirm(
            `Add Nodus to ${clientTargetLabel(target)} using its bundled stdio adapter? ` +
            "This updates that app's user MCP configuration. Existing files are backed up first." +
            (targetInfo && !targetInfo.detected
                ? "\n\nNodus did not detect this app on the system. Continue and create its config anyway?"
                : "")
        )) return;
        setBridgeBusy(true);
        setBridgeError("");
        setBridgeNotice("");
        try {
            const setup = await invoke<AiClientSetup>("configure_ai_client", {
                clientId: client.id,
                target
            });
            setBridgeNotice(
                `Configured ${clientTargetLabel(target)} at ${setup.configPath}` +
                (setup.backupPath ? ` · backup: ${setup.backupPath}` : "")
            );
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        } finally {
            setBridgeBusy(false);
        }
    };

    const unconfigureBridgeClient = async () => {
        const target = bridgeSetupTarget();
        if (!window.confirm(
            `Remove only the Nodus server entry from ${clientTargetLabel(target)}? ` +
            "A backup of the current configuration will be created first."
        )) return;
        setBridgeBusy(true);
        setBridgeError("");
        setBridgeNotice("");
        try {
            const setup = await invoke<AiClientSetup>("unconfigure_ai_client", { target });
            setBridgeNotice(
                `Removed Nodus from ${clientTargetLabel(target)} · backup: ${setup.backupPath}`
            );
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        } finally {
            setBridgeBusy(false);
        }
    };

    const copyBridgeToken = async () => {
        try {
            await navigator.clipboard.writeText(newBridgeToken());
            setBridgeError("");
            setBridgeNotice("Pairing token copied. Use it only in a secure HTTP credential input.");
        } catch (error) {
            setBridgeError(error instanceof Error ? error.message : "Could not copy the pairing token.");
        }
    };

    const handleBridgeRequest = async (request: BridgeRequest) => {
        let response: unknown;
        try {
            response = await handleAiBridgeRequest(request.method, request.params, {
                ...commandOptions(),
                externalInvocation: true,
                confirm: message => window.confirm(
                    `AI client "${request.clientName}" requests:\n\n${message}`
                )
            });
            if (request.method === "tools/call") {
                const call = request.params as { name?: unknown };
                const toolResponse = response as { isError?: boolean };
                append("command", `AI client "${request.clientName}" · ${String(call.name || "tool call")}`);
                append(
                    toolResponse.isError ? "error" : "success",
                    toolResponse.isError ? "Tool call failed." : "Tool call completed."
                );
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response = {
                content: [{ type: "text", text: message }],
                isError: true
            };
            append("error", `AI client "${request.clientName}" · tool call failed.`);
            console.error("AI tool call failed.", error);
        }

        try {
            await invoke("complete_ai_bridge_request", {
                requestId: request.requestId,
                result: response
            });
        } catch (error) {
            console.error("Could not return AI bridge response to the native host.", error);
        }
    };

    const runCommand = async (value: string) => {
        const command = value.trim();
        if (!command || isRunning()) return;

        if (authPrompt()) {
            const prompt = authPrompt()!;
            if (command.toLowerCase() === ":cancel") {
                setAuthPrompt(null);
                setInput("");
                append("success", "Authentication prompt cancelled.");
                return;
            }
            setInput("");
            setIsRunning(true);
            try {
                const result = await completeConsoleAuthPrompt(prompt, command, commandOptions());
                setAuthPrompt(result.prompt || null);
                append(result.ok ? "success" : "error", result.output);
            } catch (error) {
                setAuthPrompt(null);
                append("error", error instanceof Error ? error.message : "Authentication failed.");
            } finally {
                setIsRunning(false);
            }
            return;
        }

        setHistory(previous => [...previous.filter(item => item !== command), command].slice(-HISTORY_LIMIT));
        setHistoryIndex(-1);
        setInput("");
        setIsRunning(true);
        const result = await executeConsoleCommand(command, {
            ...commandOptions(),
            confirm: message => window.confirm(message)
        });
        setIsRunning(false);

        if (result.clear) {
            setEntries([]);
            return;
        }

        append("command", `> ${command}`);
        if (result.output) append(result.ok ? "success" : "error", result.output);
        setAuthPrompt(result.prompt || null);
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
        if (isRecordingShortcut()) {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                setIsRecordingShortcut(false);
                return;
            }
            if (["Control", "Meta", "Alt", "Shift"].includes(event.key)) return;
            if (!event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            const nextShortcut = {
                code: event.code,
                ctrl: event.ctrlKey,
                meta: event.metaKey,
                alt: event.altKey,
                shift: event.shiftKey
            };
            setShortcut(nextShortcut);
            localStorage.setItem("nodus_console_shortcut", JSON.stringify(nextShortcut));
            setIsRecordingShortcut(false);
            return;
        }
        if (!event.repeat && matchesShortcut(event, shortcut())) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setIsOpen(open => !open);
        }
    };

    onMount(() => {
        window.addEventListener("keydown", handleGlobalKeyDown, true);
        if (!isTauri()) return;
        void refreshBridgeState();
        void listen<BridgeRequest>("nodus-ai-bridge-request", event => {
            void handleBridgeRequest(event.payload);
        }).then(unlisten => {
            if (bridgeListenerDisposed) unlisten();
            else unlistenBridge = unlisten;
        }).catch(error => {
            console.error("Could not listen for native AI bridge requests.", error);
        });
    });
    onCleanup(() => {
        bridgeListenerDisposed = true;
        unlistenBridge?.();
        window.removeEventListener("keydown", handleGlobalKeyDown, true);
        stopResizing();
    });

    createEffect(() => {
        if (isOpen()) requestAnimationFrame(() => inputRef?.focus());
        entries();
        requestAnimationFrame(() => {
            if (outputRef) outputRef.scrollTop = outputRef.scrollHeight;
        });
    });

    const handleInputKeyDown = (event: KeyboardEvent) => {
        if (isRecordingShortcut() || matchesShortcut(event, shortcut())) return;
        event.stopPropagation();

        if (event.key === "Enter") {
            event.preventDefault();
            void runCommand(input());
        } else if (event.key === "Escape") {
            event.preventDefault();
            if (authPrompt()) {
                setAuthPrompt(null);
                setInput("");
                append("success", "Authentication prompt cancelled.");
                return;
            }
            setIsOpen(false);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            const previousIndex = historyIndex() < 0 ? history().length - 1 : Math.max(0, historyIndex() - 1);
            setHistoryIndex(previousIndex);
            setInput(history()[previousIndex] || "");
        } else if (event.key === "ArrowDown" && historyIndex() >= 0) {
            event.preventDefault();
            const nextIndex = historyIndex() + 1;
            if (nextIndex >= history().length) {
                setHistoryIndex(-1);
                setInput("");
            } else {
                setHistoryIndex(nextIndex);
                setInput(history()[nextIndex]);
            }
        }
    };

    return (
        <>
            {!isOpen() && (<button
                class={styles.launcher}
                aria-label="Open command console"
                title={`Command console (${shortcutLabel()})`}
                onClick={() => setIsOpen(true)}
            >
                <span aria-hidden="true">&gt;_</span>
                <span>Console</span>
            </button>)}
            {isOpen() && (
                <section
                    class={styles.panel}
                    style={{ height: `${panelHeight()}px` }}
                    aria-label="Command console"
                >
                    <div
                        class={styles.resizeHandle}
                        role="separator"
                        aria-label="Resize command console"
                        aria-orientation="horizontal"
                        onPointerDown={startResizing}
                    />
                    <header class={styles.header}>
                        <strong>Nodus Console</strong>
                        <span>
                            App commands · {isRecordingShortcut() ? "Press Ctrl/Meta/Alt shortcut (Esc cancels)" : `${shortcutLabel()} to toggle`}
                        </span>
                        <button
                            aria-label="Manage AI integration"
                            title="Manage local AI access"
                            onClick={() => {
                                const wasOpen = showAiAccess();
                                setShowAiAccess(!wasOpen);
                                if (!wasOpen) void refreshBridgeState();
                            }}
                        >
                            AI Access
                        </button>
                        <button
                            aria-label="Change command-console shortcut"
                            title="Set keyboard shortcut"
                            onClick={() => setIsRecordingShortcut(true)}
                        >
                            Shortcut
                        </button>
                        <button aria-label="Close command console" onClick={() => setIsOpen(false)}>×</button>
                    </header>
                    <div class={styles.output} ref={outputRef} role="log" aria-live="polite">
                        <For each={entries()}>
                            {entry => <pre class={styles[entry.kind]}>{entry.text}</pre>}
                        </For>
                    </div>
                    <form
                        class={styles.inputRow}
                        onSubmit={event => {
                            event.preventDefault();
                            void runCommand(input());
                        }}
                    >
                        <label for="nodus-command-input">&gt;</label>
                        <input
                            id="nodus-command-input"
                            ref={inputRef}
                            type={authPrompt() ? "password" : "text"}
                            value={input()}
                            onInput={event => setInput(event.currentTarget.value)}
                            onKeyDown={handleInputKeyDown}
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck={false}
                            placeholder={
                                isRunning()
                                    ? "Running..."
                                    : authPrompt()
                                        ? 'Password entry is masked; type ":cancel" to abort'
                                        : 'Type "help" for commands'
                            }
                            disabled={isRunning()}
                        />
                    </form>
                </section>
            )}
            <Show when={showAiAccess()}>
                <section class={styles.aiPanel} role="dialog" aria-label="AI integration access">
                    <header>
                        <strong>Local AI access</strong>
                        <button aria-label="Close AI access panel" onClick={() => {
                            setShowAiAccess(false);
                            setNewBridgeToken("");
                            setBridgeError("");
                            setBridgeNotice("");
                        }}>×</button>
                    </header>
                    <p>
                        Requests run through your active Nodus session and room role.
                        Sensitive actions require confirmation. Login credentials and Heza eval are not exposed.
                    </p>
                    <Show when={isTauri()} fallback={
                        <p class={styles.bridgeError}>Use the native Tauri app to enable the bridge; Vite browser mode cannot host it.</p>
                    }>
                        <p class={styles.bridgeStatus}>
                            MCP bridge: <strong>{bridgeStatus()?.enabled ? "enabled" : "disabled"}</strong>
                        </p>
                        <Show when={bridgeStatus()?.enabled} fallback={
                            <button disabled={bridgeBusy()} onClick={() => void startBridge()}>
                                Enable local bridge
                            </button>
                        }>
                            <p>
                                Streamable HTTP endpoint. For automatic setup, select an app below; Nodus
                                uses its bundled stdio adapter and keeps the token in the system credential store.
                            </p>
                            <code>{bridgeStatus()?.endpoint}</code>
                            <button disabled={bridgeBusy()} onClick={() => void stopBridge()}>
                                Disable local bridge
                            </button>
                        </Show>
                        <div class={styles.pairClient}>
                            <label>
                                Client name
                                <input
                                    value={bridgeClientName()}
                                    onInput={event => setBridgeClientName(event.currentTarget.value)}
                                    maxlength="60"
                                    disabled={bridgeBusy() || !bridgeStatus()?.enabled}
                                />
                            </label>
                            <button
                                disabled={bridgeBusy() || !bridgeStatus()?.enabled}
                                onClick={() => void pairBridgeClient()}
                            >
                                Pair client
                            </button>
                        </div>
                        <Show when={newBridgeToken()}>
                            <div class={styles.pairToken}>
                                <strong>Copy this token now. It cannot be shown again.</strong>
                                <code>{newBridgeToken()}</code>
                                <button onClick={() => void copyBridgeToken()}>Copy token</button>
                                <small>
                                    The bundled stdio adapter stores it securely. For direct HTTP setup, use it
                                    only in a secret input; never save it in a repository or AI prompt.
                                </small>
                            </div>
                        </Show>
                        <label class={styles.clientTarget}>
                            Configure app
                            <select
                                value={bridgeSetupTarget()}
                                onChange={event => {
                                    const target = event.currentTarget.value;
                                    if (target === "vscode" || target === "claude" || target === "cursor") {
                                        setBridgeSetupTarget(target);
                                    }
                                }}
                                disabled={bridgeBusy()}
                            >
                                <For each={bridgeTargets()}>
                                    {target => (
                                        <option value={target.id}>
                                            {target.label} · {target.detected ? "detected" : "not detected"}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </label>
                        <Show when={bridgeClients().length > 0}>
                            <div class={styles.pairedClients}>
                                <strong>Paired clients</strong>
                                <For each={bridgeClients()}>
                                    {client => (
                                        <div>
                                            <span>{client.name}</span>
                                            <button
                                                disabled={bridgeBusy()}
                                                onClick={() => void configureBridgeClient(client)}
                                            >
                                                Configure
                                            </button>
                                            <button
                                                disabled={bridgeBusy()}
                                                onClick={() => void revokeBridgeClient(client)}
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                        <button
                            disabled={bridgeBusy()}
                            onClick={() => void unconfigureBridgeClient()}
                        >
                            Remove from selected app
                        </button>
                        <Show when={bridgeNotice()}>
                            <p class={styles.bridgeNotice}>{bridgeNotice()}</p>
                        </Show>
                        <Show when={bridgeError()}>
                            <p class={styles.bridgeError}>{bridgeError()}</p>
                        </Show>
                    </Show>
                </section>
            </Show>
        </>
    );
};
