import { Lobby } from "./views/Lobby/Lobby";
import { createSignal, Match, onCleanup, onMount, Switch } from "solid-js";
import { Editor } from "./views/Editor/Editor";
import "./App.css";
import { nodusCanvas } from "./core/NodusCanvas";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { showToast } from "./models/toast";
import { updateRoomId } from "./models/userStore";
import { initializeGlobalKeyboardEvents, removeGlobalKeyboardEvents } from "./utils/keyboard";

const startView : 'lobby' | 'editor' = 'lobby';

function App() {
    const [currentView, setCurrentView] = createSignal<'lobby' | 'editor'>(startView);
    let canvasRef : HTMLCanvasElement | undefined;

    onMount(async () => {
        if(canvasRef){
            initializeGlobalKeyboardEvents();

            await nodusCanvas.init(canvasRef);
            
            onCleanup(() => {
                nodusCanvas.destroy();

                removeGlobalKeyboardEvents();
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

export default App;