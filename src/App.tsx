import { Lobby } from "./views/Lobby/Lobby";
import { createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { Editor } from "./views/Editor/Editor";
import { nodusCanvas } from "./core/NodusCanvas";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
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

    onOpenUrl((urls) => {

        console.log(urls);

        const url = new URL(urls[0]);
        const id = url.searchParams.get('id');

        if(id){
            showToast(`Cargando sala: ${id}`);
            updateRoomId(id);
            setIsExternalOpen(true);
        }
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