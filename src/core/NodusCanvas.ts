import CanvasKitInit, {Surface, FontMgr, CanvasKit} from "canvaskit-wasm";
import { getFontData } from "./engine";
import { invalidateAllResources, invalidateParagraphCache } from "./renderer";
import { mouseEvents } from "../utils/mouse";
import { createCameraStore } from "./camera";
import { userData } from "../models/userStore";

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
    private resizeObserver: ResizeObserver | null = null;
    private isResizing: boolean = false;
    private resizeTimeout: number | null = null;

    private crashCount = 0;
    private isRecovering = false;

    private async handleCanvasCrash(_: any) {
        if (this.isRecovering) return;
        this.isRecovering = true;
        this.crashCount++;

        if (this.crashCount > 3) {
            console.error("Demasiados fallos seguidos. Forzando recarga limpia de la aplicación...");
            window.location.reload();
            return;
        }

        console.warn(`[Recuperación] Intento ${this.crashCount} de reestabilizar el lienzo...`);

        try {
            // 1. Invalidar ABSOLUTAMENTE TODO
            invalidateAllResources();
            invalidateParagraphCache();

            // 2. Forzar recolección de basura si es posible
            if (typeof (globalThis as any).gc === 'function') {
                (globalThis as any).gc();
            }

            // 3. Destruir superficie vieja
            if (this.sufrace) {
                try {
                    if (!(this.sufrace as any).isDeleted?.()) {
                        this.sufrace.delete();
                    }
                } catch (e) {
                    console.log("La superficie ya estaba destruida internamente.");
                }
                this.sufrace = null;
            }

            // 4. Esperar más tiempo para estabilizar
            await new Promise(resolve => setTimeout(resolve, 500));

            // 5. Recrear superficie
            console.log("[Recuperación] Recreando superficie gráfica...");
            this.sufrace = this.CK.MakeWebGLCanvasSurface(this.canvasRef, this.CK.ColorSpace.SRGB, {
                antialias: 1, depth: 1, stencil: 1
            });
            
            if (!this.sufrace) {
                console.warn("[Recuperación] WebGL no responde, usando renderizado por Software.");
                this.sufrace = this.CK.MakeSWCanvasSurface(this.canvasRef);
            }

            if (!this.sufrace) {
                throw new Error("No se pudo crear una superficie de recuperación.");
            }

            // 6. Resetear contador después de 5 segundos de estabilidad
            setTimeout(() => {
                this.crashCount = 0;
            }, 5000);

            this.isRecovering = false;
            this.needsRedraw = true;
            
            // 7. Forzar un redibujo inmediato
            this.render();

        } catch (recoveryError) {
            console.error("El motor de recuperación también falló. Aplicando hard-reset:", recoveryError);
            window.location.reload();
        }
    }

    async init(canvasElement: HTMLCanvasElement){
        console.log("[NodusCanvas] Init started");
        this.canvasRef = canvasElement;

        // Usar capture: true para mejor rendimiento en eventos
        this.canvasRef.addEventListener("mousedown", (e) => mouseEvents.onClick(e));
        this.canvasRef.addEventListener("mousemove", (e) => mouseEvents.onMove(e));
        this.canvasRef.addEventListener("mouseup", (e) => mouseEvents.onUp(e));

        // Reutilizar instancia de CanvasKit si existe
        if (cachedCK) {
            console.log("[NodusCanvas] Using cached CK");
            this.CK = cachedCK;
        } else {
            console.log("[NodusCanvas] Loading CanvasKit...");
            this.CK = await CanvasKitInit({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/${file}`,
            });
            cachedCK = this.CK;
            console.log("[NodusCanvas] CanvasKit loaded");
        }

        // Reutilizar font si existe
        if (cachedFont) {
            this.font = cachedFont;
        } else {
            this.font = this.CK.FontMgr.FromData(await getFontData());
            cachedFont = this.font;
        }

        console.log("[NodusCanvas] Calling resize...");
        await this.resize();
        
        console.log("[NodusCanvas] Setting up resize observer...");
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
            console.log("[NodusCanvas] Surface ready, starting loop");
            this.startLoop();
        } else {
            console.warn("[NodusCanvas] No surface after resize!");
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

    private render = () => {
        if (!this.sufrace || !this.draw) {
            console.warn("[NodusCanvas] No surface or draw, scheduling next frame");
            this.animationFrameId = requestAnimationFrame(this.render);
            return;
        }

        try {
            const canvas = this.sufrace.getCanvas();
            
            // 1. Limpiar el lienzo (coordenadas de pantalla, inmune a la matriz)
            canvas.clear(this.CK.parseColorString(userData.currentProjectProperties.backgroundColor || "#0A0E1A"));
            
            // 2. CRÍTICO: Guardar el estado limpio de la matriz antes de aplicar la cámara
            canvas.save();
            
            // 3. Aplicar la cámara (ahora se aplica de forma limpia desde el origen en cada frame)
            this.camera.applyToCanvas(canvas);
            
            // 4. EJECUTAR EL DIBUJO (Aquí corre tu draw del Editor)
            this.draw(); 
            
            // 5. CRÍTICO: Restaurar la matriz original para que el siguiente frame empiece limpio
            canvas.restore();
            
            // 6. Enviar comandos a la GPU
            this.sufrace.flush();

            this.animationFrameId = requestAnimationFrame(this.render);

        } catch (error) {
            console.error("💥 Catástrofe en el Render Loop de CanvasKit:", error);
            cancelAnimationFrame(this.animationFrameId);
            this.handleCanvasCrash(error);
        }
    }

    private startLoop(){        
        this.render();
    }

    async resize(){
        console.log("[NodusCanvas] Resize called");
        if(!this.canvasRef || !this.CK){
            console.warn("[NodusCanvas] Resize: no canvas or CK");
            return
        };
        
        if (this.isResizing){
            console.log("[NodusCanvas] Resize: already resizing");
            return;
        }
        this.isResizing = true;

        if(this.needsRedraw){
            invalidateAllResources();
            invalidateParagraphCache();
        }
        
        try {
            const cssWidth = window.innerWidth;
            const cssHeight = window.innerHeight;
            const dpr = this.camera.getDPR();

            console.log(`[NodusCanvas] Resize to ${cssWidth}x${cssHeight} @${dpr}x`);

            this.canvasRef.width = cssWidth * dpr;
            this.canvasRef.height = cssHeight * dpr;
            this.canvasRef.style.width = `${cssWidth}px`;
            this.canvasRef.style.height = `${cssHeight}px`;

            const needsNewSurface = !this.sufrace || 
                this.sufrace.width() !== this.canvasRef.width || 
                this.sufrace.height() !== this.canvasRef.height;

            console.log(`[NodusCanvas] Needs new surface: ${needsNewSurface}`);

            if (needsNewSurface) {
                // --- CRÍTICO: Invalidar TODO antes de recrear ---
                // 1. Invalidar recursos de renderer
                invalidateAllResources();  // <-- Esta función ya existe, asegurarse que limpia TODO
                invalidateParagraphCache();
                
                // 2. Destruir superficie vieja
                if (this.sufrace) {
                    try {
                        if (!(this.sufrace as any).isDeleted?.()) {
                            this.sufrace.delete();
                        }
                    } catch (e) {
                        console.warn("Error al limpiar la superficie anterior:", e);
                    }
                    this.sufrace = null;
                }

                await this._createNewSurface();
                
                this.isResizing = false;
                return; // Salir temprano, la creación se hará en el timeout
            }
            
            this.needsRedraw = true;
        } catch (error) {
            console.error("Error en resize:", error);
        } finally {
            this.isResizing = false;
        }
    }

    private async _createNewSurface(): Promise<void> {
        console.log("[NodusCanvas] Creating new surface...");

        await new Promise(resolve => setTimeout(resolve, 50));

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
                console.log("[NodusCanvas] WebGL surface created");
                this.sufrace = newSurface;
                // Invalidar nuevamente por si acaso
                invalidateAllResources();
                invalidateParagraphCache();
                this.needsRedraw = true;
            } else {
                console.warn("[NodusCanvas] WebGL surface failed, trying CPU fallback...");
                throw new Error("WebGL surface creation failed");
            }
        } catch (e) {
            console.warn("Fallback a CPU rendering");
            const newSurfaceCPU = this.CK.MakeSWCanvasSurface(this.canvasRef);
            if (newSurfaceCPU) {
                console.log("[NodusCanvas] CPU surface created");
                this.sufrace = newSurfaceCPU;
                invalidateAllResources();
                invalidateParagraphCache();
                this.needsRedraw = true;
            } else {
                console.error("No se puede crear un contexto de dibujo");
            }
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