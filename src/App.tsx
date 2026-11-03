import { Lobby } from "./views/Lobby/Lobby";
import { createEffect, createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { Editor } from "./views/Editor/Editor";
import { nodusCanvas } from "./core/NodusCanvas";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { showToast } from "./models/toast";
import { updateRoomId } from "./models/userStore";
import { initializeGlobalKeyboardEvents, removeGlobalKeyboardEvents } from "./utils/keyboard";
import "./App.css";
import "./index.css";
import { LicenseGuard } from "./components/LicenseGuard";
import { Login } from "./views/Auth/Login";
import { Signup } from "./views/Auth/Singup";
import { authStore } from "./models/authStore";
import { LOADER } from "./views/components/Transition";
import { CommandConsole } from "./components/CommandConsole";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { login, logout, signup } from "./models/authStore";
import type { LicenseCommandController } from "./components/LicenseGuard";

const startView : 'lobby' | 'editor' = 'lobby';
type MainView = 'lobby' | 'editor';

const handleContextMenu = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, [contenteditable='true']"))) {
        return;
    }

    event.preventDefault();
};

function NodusFlowApp(props: {
    currentView: () => MainView;
    onNavigate: (view: MainView) => void;
}) {
    let canvasRef : HTMLCanvasElement | undefined;

    onMount(async () => {
        if(canvasRef){

            await nodusCanvas.init(canvasRef);
            
            onCleanup(() => {
                nodusCanvas.destroy();

            });
        }
    });

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
        

            <canvas 
                ref={canvasRef}
                style={{
                    cursor: "crosshair",
                    display: "block",
                    outline: "none",
                    "touch-action": "none",
                    width: "100%",
                    height: "100%",
                    filter: nodusCanvas.isResizing[0]()? "blur(20px)" : "none",
                    transition: "filter 0.5s ease"
                }}
            />

    
            <Switch>
                <Match when={props.currentView() === 'lobby'}>
                    <Lobby onNavigate={props.onNavigate}/>
                </Match>

                <Match when={props.currentView() === 'editor'}>
                    <Editor onNavigate={props.onNavigate}/>
                </Match>
            </Switch>
        </div>
    );
}

function AuthRouter(props: {showSignup: () => boolean; setShowSignup: (value: boolean) => void}) {
    const handleLoginSuccess = () => {
        // La app se mostrará automáticamente porque isAuthenticated cambió
    };

    return (
        <Show when={!props.showSignup()} fallback={
            <Signup 
                onSuccess={() => props.setShowSignup(false)}
                onSwitchToLogin={() => props.setShowSignup(false)}
            />
        }>
            <Login 
                onSuccess={handleLoginSuccess} 
                onSwitchToSignup={() => props.setShowSignup(true)}
            />
        </Show>
    );
}

function App() {

    const isAuthenticated = createMemo(() => authStore.isAuthenticated);

    const [isExternalOpen, setIsExternalOpen] = createSignal(false);
    const [showSignup, setShowSignup] = createSignal(false);
    const [currentView, setCurrentView] = createSignal<MainView>(startView);
    const [licenseController, setLicenseController] = createSignal<LicenseCommandController | null>(null);

    createEffect(() => {
        if (isExternalOpen()) setCurrentView('editor');
    });

    const screen = () => {
        if (!isAuthenticated()) return showSignup() ? "signup" : "login";
        const status = licenseController()?.status();
        if (!status || status.loading) return "license-loading";
        if (!status.valid) return "license";
        return currentView();
    };

    const setFullscreen = async (value?: boolean) => {
        const appWindow = getCurrentWindow();
        const current = await appWindow.isFullscreen();
        const next = value ?? !current;
        if (next !== current) await appWindow.setFullscreen(next);
        return next;
    };

    const consoleOptions = {
        getScreen: screen,
        setAuthView: (view: "login" | "signup") => setShowSignup(view === "signup"),
        login,
        signup,
        logout,
        retryLicense: async () => {
            const controller = licenseController();
            if (!controller) throw new Error("License validation is not available yet.");
            return controller.retry();
        },
        getLicenseStatus: () => licenseController()?.status() ?? { loading: true },
        openLicenseSupport: async () => {
            const supportEmail = licenseController()?.status().supportEmail;
            if (!supportEmail) throw new Error("License support email is unavailable.");
            await openUrl(`mailto:${supportEmail}`);
        },
        getFullscreen: async () => getCurrentWindow().isFullscreen(),
        setFullscreen,
        onHome: () => {
            if (screen() !== "editor") throw new Error("Home is only available from the editor.");
            setCurrentView("lobby");
        },
        prepareForProjectNavigation: async () => {
            if (currentView() === 'editor') {
                setCurrentView('lobby');
                await new Promise<void>(resolve => window.setTimeout(resolve, 0));
            }
        },
        navigate: (view: MainView) => setCurrentView(view)
    };

    onMount(() => {
        initializeGlobalKeyboardEvents();
        document.addEventListener("contextmenu", handleContextMenu, true);
    });

    onCleanup(() => {
        removeGlobalKeyboardEvents();
        document.removeEventListener("contextmenu", handleContextMenu, true);
    });

    const handleDeepLinks = (urls: string[]) => {
        console.log("[deeplink] URL received", urls);

        for (const value of urls) {
            let url: URL;

            try {
                url = new URL(value);
            } catch (error) {
                console.error("[deeplink] Invalid URL", value, error);
                continue;
            }

            const id = url.searchParams.get('id') ?? url.searchParams.get('d');

            if (id) {
                showToast(`Cargando sala: ${id}`);
                updateRoomId(id);
                setIsExternalOpen(true);
                return;
            }
        }
    };

    onMount(() => {
        let unlisten: (() => void) | undefined;
        let disposed = false;

        const setupDeepLinks = async () => {
            unlisten = await onOpenUrl(handleDeepLinks);

            const currentUrls = await getCurrent();
            if (!disposed && currentUrls?.length) {
                handleDeepLinks(currentUrls);
            }
        };

        void setupDeepLinks().catch((error) => {
            console.error("[deeplink] Failed to initialize deep-link listener", error);
        });

        onCleanup(() => {
            disposed = true;
            unlisten?.();
        });
    });

    return (
        <>
            <LOADER />
            <Show when={!isAuthenticated()}>
                <AuthRouter
                    showSignup={showSignup}
                    setShowSignup={setShowSignup}
                />
            </Show>
            <Show when={isAuthenticated()}>
                <LicenseGuard onController={setLicenseController}>
                    <NodusFlowApp
                        currentView={currentView}
                        onNavigate={setCurrentView}
                    />
                </LicenseGuard>
            </Show>
            <CommandConsole options={consoleOptions} />
        </>
    );
}

export default App;