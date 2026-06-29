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

const startView : 'lobby' | 'editor' = 'lobby';

function NodusFlowApp() {

    const [currentView, setCurrentView] = createSignal<'lobby' | 'editor'>(startView);
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

    onOpenUrl((urls) => {
        const url = new URL(urls[0]);
        const id = url.searchParams.get('id');

        if(id){
            showToast(`Cargando sala: ${id}`);
            updateRoomId(id);
            setCurrentView('editor');
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
                    "touch-action": "none"
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

    onMount(() => {
        initializeGlobalKeyboardEvents();
    });

    onCleanup(() => {
        removeGlobalKeyboardEvents();
    })

    return (
        <Show when={isAuthenticated()} fallback={<AuthRouter />}>
            <LicenseGuard>
                <NodusFlowApp />
            </LicenseGuard>
        </Show>
    );
}

export default App;