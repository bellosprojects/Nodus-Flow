import type { CanvasKit, Image as CanvasKitImage } from "canvaskit-wasm";
import { ImagePlugin } from "./ImagePlugin";
import { CounterWidgetPlugin } from "./ConuterWidget";
import { addNodeProperty, finalizeNodeSize, getNode, Node, updateNodeSize } from "../models/nodes";
import { actionUpdateNodeTitle } from "../core/actions";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { createSignal } from "solid-js";

const ALLOWEB_NETWORK_PROTOCOLS = /^https?:\/\//i;

export interface PluginContext {
    ck?: CanvasKit; // Ck para dibujado (si aplica)

    // API segura para modificar el nodo actual (debe tener el permiso "node")
    nodeApi?: {
        updateNodeTitle(newTitle: string): void;
        updateProperty(key: string, value: any): void;
        resize(width: number, height: number): void;
    };

    // API segura para web (debe incluir el permiso network)
    network?: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    };

}

export type Permission = "node" | "network";

export interface PluginManifest {
    id: string; // Identificador unico del plugin
    name: string; // Nombre visible del plugin
    version: string; // Version del plugin vX.Y.Z
    nodusVersion: string; // Version minima de Nodus vX.Y.Z
    publisher: string; // Nick del usuario creador
    description: string; // Descripcion del plugin
    usageProperties: Record<string, string>; // Listas de propiedades que usa {propiedad: descripcion}. Si no se declaran aqui la app no le dara permiso de lectura de esa propiedad
    tags: string[]; // Etiquetas del plugin (para busqueda)
    permissions: Permission[]; // Permisos del plugin
}

export interface PluginView {
    renderView(container: HTMLElement): void; // Renderiza la View del Plugin (configuracion, graficos, etc...) en el planel de extensiones
    onViewClose?(): void; // Limpiar memoria al cerrar la vista
    getState?(): Record<string, any>; // Estado para serializacion (no implementado)
}

export interface PluginRender {
    renderType: "Skia" | "HTML";    // Tipo de renderizador (la app no le pasa un ck si no lo usa)

    renderCanvas(witdh: number, height: number): CanvasKitImage | null;   // Renderizador Canvas de alto rendimiento
    renderHTML(container: HTMLElement): void;      // Renderizador HTML avanzado
}

export interface PluginListeners {
    onPropertyChanges?(propertyName: string, propertyValue: any): void;     // Una propiedad cambio (debe declararse en manifest.usageProperties)

    // Listeners del mouuse
    // Todas las cordenadas son relativas al tamaño (0,0 para arriba/izquierda y 100,100 para abajo/derecha)
    // El zoom y offset los procesa el objeto de Camera
    onClick?(localX: number, localY: number): void;
    onMouseMove?(localX: number, localY: number): void;
    onDoubleClick?(localX: number, localY: number): void;
    onRightClick?(localX: number, localY: number): void;
    onMouseUp?(localX: number, localY: number): void;
}

export interface PluginInstance {
    manifest: PluginManifest;
    view: PluginView;
    render: PluginRender;
    listeners: PluginListeners;

    // Carga inicial
    onLoad(data: Record<string, any>, context: PluginContext): void;

    // Liberacion de memoria si hace falta
    onDestroy(): void;
}

class PluginManager {
    private registeredPlugins: Map<string, PluginInstance> = new Map();
    private activeInstances: Map<string, PluginInstance> = new Map();
    private failedPlugins: Set<string> = new Set();
    private static readonly URL_HINT = /(url|uri|http|https|endpoint|cdn|href|src|remote|web)/i;

    private versionSignal = createSignal(0);
    getVersion() { return this.versionSignal[0](); }
    private bumpVersion() { this.versionSignal[1](v => v + 1); }

    private declaredURLProps(manifest: PluginManifest): boolean {
        return Object.entries(manifest.usageProperties || {}).some(
            ([key, desc]) => PluginManager.URL_HINT.test(key) || PluginManager.URL_HINT.test(desc),
        );
    }

    constructor(){
        this.registerPlugin(new ImagePlugin());
        this.registerPlugin(new CounterWidgetPlugin());
    }

    registerPlugin(plugin: PluginInstance) {
        this.registeredPlugins.set(plugin.manifest.id, plugin);
        this.bumpVersion();
    }

    initNodePlugin(nodeId: string, pluginId: string, node: Node, baseContext: PluginContext){
        const basePlugin = this.registeredPlugins.get(pluginId);
        if(!basePlugin){
            console.warn(`Plugin con id ${pluginId} no encontrado`);
            return;
        }

        if(this.activeInstances.has(nodeId)){
            this.destroyNodePlugin(nodeId);
        }

        const Ctor = basePlugin.constructor as new () => PluginInstance;
        const instance : PluginInstance = new Ctor();

        const needsNetwork = this.declaredURLProps(instance.manifest);
        const hasNetwork = instance.manifest.permissions.includes("network");
        if(needsNetwork && !hasNetwork) {
            console.error(
                `[${pluginId}] declara propiedades URL pero no pide permiso "network". Plugin rechazado en nodo ${nodeId}.`,
            );
            this.failedPlugins.add(nodeId);
            try { instance.onDestroy(); } catch {}
            return;
        }

        const declared = Object.keys(instance.manifest.usageProperties || {});
        const filteredProps: Record<string, any> = {};
        for(const key of declared){
            if(key in node.properties) filteredProps[key] = node.properties[key];
        }

        const context: PluginContext = { ck: baseContext.ck };
        if(instance.manifest.permissions.includes("node")) {
            context.nodeApi = this.buildNodeApi(nodeId, instance);
        }

        if(hasNetwork) {
            context.network = {
                fetch: (input, init) => {
                    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

                    if(!ALLOWEB_NETWORK_PROTOCOLS.test(url)){
                        return Promise.reject(
                            new Error(
                                `[PluginManager] Protocolo no permitido para red: ${url}`,
                            ),
                        );
                    }

                    return tauriFetch(input, init);
                },
            };
        }

        try {
            instance.onLoad(filteredProps, context);
        } catch (error) {
            console.error(
                `Error en onLoad del plugin ${pluginId} (nodo ${nodeId}):`,
                error,
            );
            this.failedPlugins.add(nodeId);
            return;
        }

        this.activeInstances.set(nodeId, instance);
        this.bumpVersion();
    }

    getNodeRenderFrame(nodeId: string, width: number, height: number): CanvasKitImage | null {
        const instance = this.activeInstances.get(nodeId);
        if(!instance?.render?.renderCanvas) return null;

        if(this.failedPlugins.has(nodeId)){
            return null;
        }

        try {
            return instance.render.renderCanvas(width, height);
        } catch(error) {
            console.error( `El plugin del nodo ${nodeId} lanzo un error critico:`,error);
            this.failedPlugins.add(nodeId);
            try {
                instance.onDestroy();
            } catch(_) {}
            return null;
        }
    }

    getNodeHTML(nodeId: string, container: HTMLElement){
        const instance = this.activeInstances.get(nodeId);
        if(!instance?.render?.renderHTML) return;

        try {
            instance.render.renderHTML(container);
        } catch (error) {
            console.error(`Error al renderizar HTML del plugin en nodo ${nodeId}:`, error);
            container.innerHTML = `<div style="color: red; font-size: 10px;">Error en Plugin HTML</div>`;
        }
    }

    destroyNodePlugin(nodeId: string) {
        const instance = this.activeInstances.get(nodeId);
        if(instance){
            try{
                instance.onDestroy();
            }
            catch(error){
                console.error( `Error al destruir el plugin del nodo ${nodeId}:`, error);
            }
            this.activeInstances.delete(nodeId);
            this.failedPlugins.delete(nodeId);
            this.bumpVersion();
        }
    }

    hasActiveInstance(nodeId: string): boolean {
        return this.activeInstances.has(nodeId);
    }

    hasHtmlRenderer(nodeId: string): boolean {
        const instance = this.activeInstances.get(nodeId);
        return !!instance?.render && instance.render.renderType === 'HTML';
    }

    getActiveInstacesIds(): string[] {
        return Array.from(this.activeInstances.keys());
    }

    getRegisteredPluginsManifest(): PluginManifest[] {
        const manifests : PluginManifest[] = [];
        this.registeredPlugins.forEach(plugin => {
            manifests.push(plugin.manifest);
        });
        return manifests;
    }

    getActivedPluginsView(): {view: PluginView; name: string; node: string}[] {
        const views : {view: PluginView; name: string; node: string}[] = [];
        this.activeInstances.forEach((plugin, nodeId) => {
            views.push({view: plugin.view, name: plugin.manifest.name, node: nodeId});
        });
        return views;
    }

    updateNodeProperties(nodeId: string, propertyName: string, propertyValue: any){
        const instance = this.activeInstances.get(nodeId);
        if(!instance?.listeners?.onPropertyChanges) return;

        if(!(propertyName in (instance.manifest.usageProperties || {}))) return;

        try{
            instance.listeners.onPropertyChanges(propertyName, propertyValue);
        } catch (error) {
            console.error(`Error al actualizar propiedades del plugin en el nodo ${nodeId}:`, error);
        }
    }

    private buildNodeApi(
        nodeId: string,
        instance: PluginInstance
    ): NonNullable<PluginContext['nodeApi']> {
        return {
            updateNodeTitle: (newTitle: string) => {
                const current = getNode(nodeId);
                if(!current) return;
                actionUpdateNodeTitle(nodeId, current.title || "", newTitle);
            },

            updateProperty: (key: string, value: any) => {
                if(!(key in (instance.manifest.usageProperties || {}))) {
                    console.warn(
                        `[${instance.manifest.id}] intento escribir propiedad no declarada: "${key}" (nodo ${nodeId})`,
                    );
                    return;
                }

                const current = getNode(nodeId);
                if(!current) return;
                addNodeProperty(nodeId, key, value);
            },

            resize: (width: number, height: number) => {
                updateNodeSize(nodeId, width, height);
                finalizeNodeSize(nodeId);
            }
        }
    }

}

export const nodusPluginManager = new PluginManager();