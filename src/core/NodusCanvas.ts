import CanvasKitInit, {Surface, FontMgr, CanvasKit} from "canvaskit-wasm";
import { getFontData } from "./engine";
import { mouseEvents } from "../utils/mouse";
import { createCameraStore } from "./camera";
import { userData } from "../models/userStore";
import { createSignal } from "solid-js";

class NodusCanvas {
    private CK!: CanvasKit;
    private sufrace: Surface | null = null;
    private animationFrameId: number = 0;
    private draw: Function | null = null;
    private onRezise: Function | null = null;
    private font: FontMgr | null = null;
    public canvasRef!: HTMLCanvasElement;
    public camera = createCameraStore();
    private resizeObserver: ResizeObserver | null = null;
    private isRunning: boolean = false;
    public isResizing = createSignal(false);

    async init(canvasElement: HTMLCanvasElement){
        console.log("[NodusCanvas] Init started");
        this.canvasRef = canvasElement;

        // Usar capture: true para mejor rendimiento en eventos
        this.canvasRef.addEventListener("mousedown", (e) => mouseEvents.onClick(e));
        this.canvasRef.addEventListener("mousemove", (e) => mouseEvents.onMove(e));
        this.canvasRef.addEventListener("mouseup", (e) => mouseEvents.onUp(e));

        this.CK = await CanvasKitInit({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/${file}`
        });

        this.font = this.CK.FontMgr.FromData(await getFontData());

        console.log("[NodusCanvas] Setting up resize observer...");
        this.resizeObserver = new ResizeObserver(() => {
            this.resize();
        });
        this.resizeObserver.observe(this.canvasRef);

        this.isRunning = true;
        this.startLoop();
    }

    private startLoop(){
        if(!this.isRunning) return;
        
        this.animationFrameId = requestAnimationFrame(() => this.startLoop());
        
        if(this.isResizing[0]()) return;
        if(!this.sufrace || !this.draw){
            return;
        }

        try {
            const canvas = this.sufrace.getCanvas();

            canvas.clear(this.CK.parseColorString(userData.currentProjectProperties.backgroundColor || "#0A0E1A"));

            canvas.save();

            this.camera.applyToCanvas(canvas);

            this.draw();

            canvas.restore();

            this.sufrace.flush();
        } catch(error){
            console.error("[NodusCanvas] Error durante el renderizado: ", error);
        }
    }

    async resize(){

        this.isResizing[1](true);

        if(this.onRezise){
            this.onRezise();
        }

        if(!this.CK || !this.canvasRef) return;

        const cssWidth = window.innerWidth;
        const cssHeight = window.innerHeight;
        const dpr = this.camera.getDPR();
        
        this.canvasRef.width = cssWidth * dpr;
        this.canvasRef.height = cssHeight * dpr;

        if(this.sufrace){
            try {
                this.sufrace.delete();
            } catch(e) {
                console.warn("Error borrando la superficie antigua:", e);
            }
            this.sufrace = null;
        }

        this.sufrace = this.CK.MakeWebGLCanvasSurface(this.canvasRef);

        if(!this.sufrace){
            console.error("No se pudo crear la superficie");
            return;
        }
        
        console.log(`[NodusCanvas] Resized de forma exitosa a: ${cssWidth}x${cssHeight} (DPR: ${dpr})`);

        setTimeout(() => {
            this.isResizing[1](false);
        }, 200);
    }

    public setDraw(action: Function){
        if(this.onRezise){
            this.onRezise();
        }
        this.draw = action;
    }

    public setOnResize(action: Function){
        this.onRezise = action;
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
        if (!this.sufrace) {
            throw new Error("Surface not initialized");
        }
        return this.sufrace.getCanvas();
    }

    public getPicture(){
        if (!this.sufrace) {
            return null;
        }
        try {
            return this.sufrace.makeImageSnapshot(this.getCanvas().getDeviceClipBounds());
        } catch (error) {
            console.error("Error getting picture:", error);
            return null;
        }
    }

    public canDraw(){
        return !this.isResizing[0]();
    }


    public destroy(){
        this.isRunning = false;
        if(this.animationFrameId){
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.sufrace) {
            this.sufrace.delete();
            this.sufrace = null;
        }
    }
}

export const nodusCanvas = new NodusCanvas();