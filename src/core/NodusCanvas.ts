import CanvasKitInit, {Surface, FontMgr, CanvasKit} from "canvaskit-wasm";
import { getFontData } from "./engine";
import { drawBackground, invalidateParagraphCache } from "./renderer";
import { mouseEvents } from "../utils/mouse";
import { createCameraStore } from "./camera";

// Cache de recursos WebGL
let cachedCK: CanvasKit | null = null;
let cachedFont: FontMgr | null = null;

class NodusCanvas {
    private CK!: CanvasKit;
    private sufrace: Surface | null = null;
    private animationFrameId: number = 0;
    private draw: Function | null = null;
    private font: FontMgr | null = null;
    public canvasRef!: HTMLCanvasElement;
    public camera = createCameraStore();
    
    // Bandera para evitar redibujos innecesarios
    private needsRedraw: boolean = true;
    private lastCameraState: { zoom: number; offsetX: number; offsetY: number } | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private isResizing: boolean = false;
    private resizeTimeout: number | null = null;

    async init(canvasElement: HTMLCanvasElement){
        this.canvasRef = canvasElement;

        // Usar capture: true para mejor rendimiento en eventos
        this.canvasRef.addEventListener("mousedown", (e) => mouseEvents.onClick(e));
        this.canvasRef.addEventListener("mousemove", (e) => mouseEvents.onMove(e));
        this.canvasRef.addEventListener("mouseup", (e) => mouseEvents.onUp(e));

        // Reutilizar instancia de CanvasKit si existe
        if (cachedCK) {
            this.CK = cachedCK;
        } else {
            this.CK = await CanvasKitInit({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/${file}`,
            });
            cachedCK = this.CK;
        }

        // Reutilizar font si existe
        if (cachedFont) {
            this.font = cachedFont;
        } else {
            this.font = this.CK.FontMgr.FromData(await getFontData());
            cachedFont = this.font;
        }

        this.resize();
        
        // Usar ResizeObserver en lugar de event listener para mejor rendimiento
        this.resizeObserver = new ResizeObserver(() => {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                this.resize();
            }, 100);
        });
        this.resizeObserver.observe(this.canvasRef);
        
        window.addEventListener('resize', this.handleWindowResize);

        if(this.sufrace){
            this.startLoop();
        }
    }

    private handleWindowResize = () => {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = window.setTimeout(() => {
            this.resize();
        }, 100);
    }

    private startLoop(){
        let frameCount = 0;
        const render = () => {
            if(this.sufrace && this.CK){
                try {
                    const canvas = this.sufrace.getCanvas();
                    if (!canvas) {
                        // Si no hay canvas, reintentar resize
                        this.resize();
                        return;
                    }
                    
                    const currentCameraState = {
                        zoom: this.camera.zoom(),
                        offsetX: this.camera.offsetX(),
                        offsetY: this.camera.offsetY()
                    };

                    // Solo redibujar si hay cambios o cada 4 frames para animaciones suaves
                    const cameraChanged = !this.lastCameraState || 
                        this.lastCameraState.zoom !== currentCameraState.zoom ||
                        this.lastCameraState.offsetX !== currentCameraState.offsetX ||
                        this.lastCameraState.offsetY !== currentCameraState.offsetY;

                    if (cameraChanged) {
                        // Invalidar caché de párrafos cuando cambia el zoom
                        if (this.lastCameraState?.zoom !== currentCameraState.zoom) {
                            invalidateParagraphCache();
                        }
                        this.needsRedraw = true;
                        this.lastCameraState = currentCameraState;
                    }

                    // Redibujar solo cuando es necesario
                    if (this.needsRedraw || frameCount % 4 === 0) {
                        canvas.save();
                        canvas.clear(this.CK.Color(2, 27, 48));
                        drawBackground();
                        this.camera.applyToCanvas(canvas);

                        if(this.draw){
                            this.draw();
                        }

                        canvas.restore();
                        this.sufrace.flush();
                        this.needsRedraw = false;
                    }
                } catch (error) {
                    console.warn("Error en render loop:", error);
                    // Intentar recuperar la superficie
                    if (!this.sufrace) {
                        this.resize();
                    }
                }
                frameCount++;
            }
            this.animationFrameId = requestAnimationFrame(render);
        };
        render();
    }

    resize = () => {
        if(!this.canvasRef || !this.CK) return;
        
        // Evitar múltiples resize simultáneos
        if (this.isResizing) return;
        this.isResizing = true;
        
        try {
            const cssWidth = window.innerWidth;
            const cssHeight = window.innerHeight;
            const dpr = this.camera.getDPR();

            this.canvasRef.width = cssWidth * dpr;
            this.canvasRef.height = cssHeight * dpr;
            this.canvasRef.style.width = `${cssWidth}px`;
            this.canvasRef.style.height = `${cssHeight}px`;

            // Solo recrear la superficie si es necesario
            const needsNewSurface = !this.sufrace || 
                this.sufrace.width() !== this.canvasRef.width || 
                this.sufrace.height() !== this.canvasRef.height;

            if (needsNewSurface) {
                // Guardar estado actual
                const oldSurface = this.sufrace;
                
                // Intentar WebGL primero
                try {
                    const newSurface = this.CK.MakeWebGLCanvasSurface(this.canvasRef, this.CK.ColorSpace.SRGB, {
                        antialias: 1,
                        depth: 1,
                        stencil: 1,
                        preserveDrawingBuffer: 0,
                        preferLowPowerToHighPerformance: 1,
                        failIfMajorPerformanceCaveat: 0,
                        enableExtensionsByDefault: 1,
                    });
                    
                    if (newSurface) {
                        this.sufrace = newSurface;
                    } else {
                        throw new Error("WebGL surface creation failed");
                    }
                } catch (e) {
                    console.warn("Fallback a CPU rendering");
                    const newSurface = this.CK.MakeSWCanvasSurface(this.canvasRef);
                    if (newSurface) {
                        this.sufrace = newSurface;
                    } else {
                        console.error("No se puede crear un contexto de dibujo");
                        this.isResizing = false;
                        return;
                    }
                }
                
                // Limpiar la superficie anterior de forma segura
                if (oldSurface && oldSurface !== this.sufrace) {
                    try {
                        oldSurface.delete();
                    } catch (e) {
                        // Ignorar errores al eliminar superficie antigua
                    }
                }
            }
            
            this.needsRedraw = true;
        } catch (error) {
            console.error("Error en resize:", error);
        } finally {
            this.isResizing = false;
        }
    }

    public setDraw(action: Function){
        this.draw = action;
        this.needsRedraw = true;
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

    public requestRedraw() {
        this.needsRedraw = true;
    }

    public destroy(){
        window.removeEventListener('resize', this.handleWindowResize);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        cancelAnimationFrame(this.animationFrameId);
        if (this.sufrace) {
            try {
                this.sufrace.delete();
            } catch (e) {
                // Ignorar errores
            }
            this.sufrace = null;
        }
    }
}

export const nodusCanvas = new NodusCanvas();