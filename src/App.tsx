import { Lobby } from "./views/Lobby/Lobby";
import { createSignal, Match, onCleanup, onMount, Switch } from "solid-js";
import { Editor } from "./views/Editor/Editor";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { nodusCanvas } from "./core/NodusCanvas";

const startView : 'lobby' | 'editor' = 'lobby';

function App() {
  const [currentView, setCurrentView] = createSignal<'lobby' | 'editor'>(startView);
  let canvasRef : HTMLCanvasElement | undefined;
  const appWindow = getCurrentWindow();

  onMount(async () => {
    if(canvasRef){
      onCleanup(() => {
        nodusCanvas.destroy();
      });

      await nodusCanvas.init(canvasRef);

      window.addEventListener('keydown', async (e) => {
            if(e.key === 'F11'){
              const isFullScreen = await appWindow.isFullscreen();
              await appWindow.setFullscreen(!isFullScreen);
            }
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