import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import {
    executeConsoleCommand,
    type CommandConsoleView
} from "../core/commandConsole";
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

export const CommandConsole = (props: {
    onNavigate: (view: CommandConsoleView) => void;
    prepareForProjectNavigation: () => Promise<void>;
}) => {
    const [isOpen, setIsOpen] = createSignal(false);
    const [input, setInput] = createSignal("");
    const [entries, setEntries] = createSignal<ConsoleEntry[]>([
        { id: 0, kind: "success", text: 'Nodus command console. Type "help" to see commands.' }
    ]);
    const [history, setHistory] = createSignal<string[]>([]);
    const [historyIndex, setHistoryIndex] = createSignal(-1);
    const [isRunning, setIsRunning] = createSignal(false);
    const [panelHeight, setPanelHeight] = createSignal(loadPanelHeight());
    const [shortcut, setShortcut] = createSignal(loadShortcut());
    const [isRecordingShortcut, setIsRecordingShortcut] = createSignal(false);
    let nextEntryId = 1;
    let inputRef: HTMLInputElement | undefined;
    let outputRef: HTMLDivElement | undefined;
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

    const runCommand = async (value: string) => {
        const command = value.trim();
        if (!command || isRunning()) return;

        setHistory(previous => [...previous.filter(item => item !== command), command].slice(-HISTORY_LIMIT));
        setHistoryIndex(-1);
        setInput("");
        setIsRunning(true);
        const result = await executeConsoleCommand(command, {
            navigate: props.onNavigate,
            prepareForProjectNavigation: props.prepareForProjectNavigation,
            confirm: message => window.confirm(message)
        });
        setIsRunning(false);

        if (result.clear) {
            setEntries([]);
            return;
        }

        append("command", `> ${command}`);
        if (result.output) append(result.ok ? "success" : "error", result.output);
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

    onMount(() => window.addEventListener("keydown", handleGlobalKeyDown, true));
    onCleanup(() => {
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
                            value={input()}
                            onInput={event => setInput(event.currentTarget.value)}
                            onKeyDown={handleInputKeyDown}
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck={false}
                            placeholder={isRunning() ? "Running..." : 'Type "help" for commands'}
                            disabled={isRunning()}
                        />
                    </form>
                </section>
            )}
        </>
    );
};
