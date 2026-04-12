import { Canvas, CanvasKit } from "canvaskit-wasm";
import { nodusCanvas } from "../../core/NodusCanvas"
import { drawGrid } from "../../core/renderer";
import { HEADER } from "../Lobby/components/Toolbars";
import { COPYRIGHT, CREATE_FLOW, RECENT_USED, USERNAME_INPUT } from "./components/Toolbars";
import style from "./Lobby.module.css";
import { generateRandomRoomId } from "../../utils/network";
import { updateRoomId, updateUserName, userData } from "../../models/userStore";
import { setViewMouseHandlers } from "../../utils/mouse";
import { setOffset, setScale } from "../Editor/Editor";

let mousePos = {
    x: 0,
    y: 0
};

let gridScroll = 0;

const drawInfiniteFloor = (canvas: Canvas, ck: CanvasKit) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const horizonY = h * 0.58 + mousePos.y / 30;
    const floorHeight = h - horizonY;
    
    const paint = new ck.Paint();
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(2);
    

    const shader = ck.Shader.MakeLinearGradient(
        [0, horizonY], [0, h],
        [ck.Color(0, 120, 106, 0), ck.Color(0, 120, 105, 1)],
        [0, 1], ck.TileMode.Clamp
    );

    paint.setShader(shader);

    const numVLines = 35;
    const centerX =  w * .45 + mousePos.x / 10;

    for (let i = 0; i <= numVLines; i++) {
        const xPos = (i / numVLines) * w * 4 - (w * 1.5); 
        canvas.drawLine(centerX, horizonY, xPos, h, paint);
    }

    gridScroll += 0.0065;
    if (gridScroll > 1) gridScroll = 0;

    const numHLines = 12;
    for (let i = 0; i < numHLines; i++) {

        const ratio = (i + gridScroll) / numHLines;
        const y = horizonY + Math.pow(ratio, 2) * floorHeight;
        
        paint.setStrokeWidth(1 + ratio * 2);
        canvas.drawLine(0, y, w, y, paint);
    }

    shader.delete();
    paint.delete();
};

export const Lobby = (props: { onNavigate: (v: 'lobby' | 'editor') => void}) => {

    const nodus = nodusCanvas;

    nodus.setDraw(() => {
        drawInfiniteFloor(nodusCanvas.getCanvas(), nodusCanvas.getCK());
        drawGrid(mousePos);
    });

    const startFlow = () => {
        const newDiagramId = generateRandomRoomId();
        updateRoomId(newDiagramId);
        props.onNavigate('editor');
    };

    const joinFlow = () => {
        const newDiagramId = (document.getElementById(style.roomIdInput) as HTMLInputElement).value;
        updateRoomId(newDiagramId);
        props.onNavigate('editor');
    };

    const recentUsed = () => {
        const newDiagramId = userData.lastRoom;
        updateRoomId(newDiagramId);
        props.onNavigate('editor');
    };

    const changeUserName = () => {
        const newUserName = (document.getElementById(style.usernameInput) as HTMLInputElement).value;
        updateUserName(newUserName);
    }

    setViewMouseHandlers({
        onMove: (e) => mousePos = {x: e.offsetX, y: e.offsetY}
    })

    setOffset(0, 0);
    setScale(1);

    return (
        
        <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", "pointer-events": "none"}}>
            <div class={style.topLeftToolbar}>
                { HEADER() }
                { RECENT_USED(recentUsed) }
            </div>

            { CREATE_FLOW(startFlow, joinFlow) }
            { USERNAME_INPUT(changeUserName)}
            { COPYRIGHT() }
        </div>
        
    );
}