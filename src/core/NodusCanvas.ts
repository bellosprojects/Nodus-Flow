import CanvasKitInit, {Surface, FontMgr, CanvasKit} from "canvaskit-wasm";
import { getFontData } from "./engine";
import { drawBackground } from "./renderer";
import { mouseEvents } from "../utils/mouse";
import { createCameraStore } from "./camera";

class NodusCanvas {
    private CK!: CanvasKit;
    private sufrace: Surface | null = null;
    private animationFrameId: number = 0;
    private draw: Function | null = null;
    private font: FontMgr | null = null;
    public canvasRef!: HTMLCanvasElement;
    public camera = createCameraStore();

    async init(canvasElement: HTMLCanvasElement){

        this.canvasRef = canvasElement;

        this.canvasRef.addEventListener("mousedown", (e) => mouseEvents.onClick(e));
        this.canvasRef.addEventListener("mousemove", (e) => mouseEvents.onMove(e));
        this.canvasRef.addEventListener("mouseup", (e) => mouseEvents.onUp(e));

        this.CK = await CanvasKitInit({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/${file}`,
        });

        this.font = this.CK.FontMgr.FromData(await getFontData());

        this.resize();
        window.addEventListener('resize', this.resize);

        if(this.sufrace){
            this.startLoop();
        }
    }

    private startLoop(){
        const render = () => {
        if(this.sufrace){

            const canvas = this.sufrace.getCanvas();

            canvas.save();

            canvas.clear(this.CK.Color(2, 27, 48));
            drawBackground();

            this.camera.applyToCanvas(canvas);

            if(this.draw){
                this.draw();
            }

            canvas.restore();
            this.sufrace.flush();
        }
        this.animationFrameId = requestAnimationFrame(render);
    };
        render();
    }

    resize = () => {

        if(!this.canvasRef) return;
        
        const cssWidth = window.innerWidth;
        const cssHeight = window.innerHeight;
        const dpr = this.camera.getDPR();

        this.canvasRef.width = cssWidth * dpr;
        this.canvasRef.height = cssHeight * dpr;

        this.sufrace?.delete();

        try {
            this.sufrace = this.CK.MakeWebGLCanvasSurface(this.canvasRef, this.CK.ColorSpace.SRGB, {
                antialias: 1,
                depth: 1,
                stencil: 1,
                preserveDrawingBuffer: 0,
                preferLowPowerToHighPerformance: 0,
                failIfMajorPerformanceCaveat: 0,
                enableExtensionsByDefault: 1,
                explicitSwapControl: 0,
                renderViaOffscreenBackBuffer: 0,
                });
                console.log("Usando WebGL");
        } catch (e){
            
            console.warn("Activando aceleracion por hardware");
            this.sufrace = this.CK.MakeSWCanvasSurface(this.canvasRef);

            if(!this.sufrace){
                console.error("No se puede crear un contexto de dibujo");
            }
        }

    }

    public setDraw(action: Function){
        this.draw = action;
    }

    public getFont(){
        return this.font;
    }

    public getAnimationFrameId(){
        return this.animationFrameId;
    }
    public getCK(){
        return this.CK;
    }

    public getCanvas(){
        return this.sufrace!.getCanvas();
    }

    public getPicture(){
        return this.sufrace!.makeImageSnapshot(this.getCanvas().getDeviceClipBounds());
    }

    public destroy(){
        window.removeEventListener('resize', this.resize);
        cancelAnimationFrame(this.animationFrameId);
        this.sufrace?.delete();
    }
}

export const nodusCanvas = new NodusCanvas();