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

const startView : 'lobby' | 'editor' = 'lobby';

function NodusFlowApp(props: {started: boolean}) {

    const [currentView, setCurrentView] = createSignal<'lobby' | 'editor'>(props.started? 'editor' : startView);
    let canvasRef : HTMLCanvasElement | undefined;

    createEffect(() => {
        if (props.started) {
            setCurrentView('editor');
        }
    });

    onMount(async () => {
        if(canvasRef){

            await nodusCanvas.init(canvasRef);
            
            onCleanup(() => {
                nodusCanvas.destroy();

            });
        }
    });

    const handleNavigate = (view: 'editor' | 'lobby') => {
        setCurrentView(view);
    };

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
                <Match when={currentView() === 'lobby'}>
                    <Lobby onNavigate={handleNavigate}/>
                </Match>

                <Match when={currentView() === 'editor'}>
                    <Editor onNavigate={handleNavigate}/>
                </Match>
            </Switch>

        </div>
    );
}

function AuthRouter() {
    const [showSignup, setShowSignup] = createSignal(false);

    const handleLoginSuccess = () => {
        // La app se mostrará automáticamente porque isAuthenticated cambió
    };

    return (
        <Show when={!showSignup()} fallback={
            <Signup 
                onSuccess={() => setShowSignup(false)} 
                onSwitchToLogin={() => setShowSignup(false)} 
            />
        }>
            <Login 
                onSuccess={handleLoginSuccess} 
                onSwitchToSignup={() => setShowSignup(true)}
            />
        </Show>
    );
}

function App() {

    const isAuthenticated = createMemo(() => authStore.isAuthenticated);

    const [isExternalOpen, setIsExternalOpen] = createSignal(false);

    onMount(() => {
        initializeGlobalKeyboardEvents();
    });

    onCleanup(() => {
        removeGlobalKeyboardEvents();
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
            <Show when={isAuthenticated()} fallback={<AuthRouter />}>
                <LicenseGuard>
                    <NodusFlowApp started={isExternalOpen()}/>
                </LicenseGuard>
            </Show>
        </>
    );
}

export default App;