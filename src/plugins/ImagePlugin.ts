import type { CanvasKit, Image as CanvasKitImage } from "canvaskit-wasm";
import { PluginInstance, PluginManifest, PluginContext, PluginView, PluginRender, PluginListeners } from "./plugins";

export class ImagePlugin implements PluginInstance {

    private ck?: CanvasKit;
    private cachedImage: CanvasKitImage | null = null;
    private imageUrl: string = '';
    private hasLoggedNoImagen = false;

    private networkFetch?: PluginContext['network'] extends infer N ? N extends { fetch: infer F } ? F : never : never;
    private loadToken = 0;
    private destroyed = false;

    manifest: PluginManifest = {
        id: 'com.nodus.image-plugin',
        name: 'Image Renderer',
        version: '1.0.0',
        nodusVersion: '1.0.0',
        publisher: 'Nodus Flow',
        'description': 'Renderiza una imagen en la posicion del nodo respetando sus dimensiones y forma',
        usageProperties: {
            "imageUrl": "URL de la imagen (de la web)"
        },
        tags: [
            'images'
        ],
        permissions: ['network']
    };

    view: PluginView = {
        renderView: (container: HTMLElement) => {
            const notConfiguration = document.createElement('p');
            notConfiguration.innerText = 'Este plugin no requiere configuracion';

            container.appendChild(notConfiguration);
        }
    };

    render: PluginRender = {

        renderType: 'Skia',

        renderCanvas: (_, __) : CanvasKitImage | null => {
            if(!this.cachedImage) if(!this.hasLoggedNoImagen){
                console.log("No imagen");
                this.hasLoggedNoImagen = true; 
            }
            return this.cachedImage;
        },

        renderHTML: (_) => {
            
        },
    };

    onURLChanged(propertyName: string, propertyValue: string) {
        if(propertyName !== 'imageUrl') return;
        const newUrl = propertyValue || '';
        this.imageUrl = newUrl;

        if(newUrl){
            if(!this.networkFetch){
                console.error('[ImagePlugin] Sin permiso de red.');
                return;
            }
            this.loadImage(this.imageUrl);
        } else if (this.cachedImage) {
            this.cachedImage.delete();
            this.cachedImage = null;
        }
    }

    listeners: PluginListeners = {
        onPropertyChanges: this.onURLChanged.bind(this)
    };

    onLoad(data: Record<string, any>, context: PluginContext){
        this.ck = context.ck;
        this.networkFetch = context.network?.fetch;
        this.imageUrl = data.imageUrl || '';

        if (this.imageUrl) {
            if(!this.networkFetch) {
                console.error('[ImagePlugin] Sin permiso de red.');
                return;
            }
            this.loadImage(this.imageUrl);
        }
    }

    private async loadImage(url: string) {
        if(!this.ck || !this.networkFetch || this.destroyed) return;

        const token = ++this.loadToken;
        
        try {
            const response = await this.networkFetch(url);
            if(this.destroyed || token !== this.loadToken) return;

            if(!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();

            if(this.destroyed || token !== this.loadToken) return;
            
            const decodedImage = this.ck.MakeImageFromEncoded(new Uint8Array(arrayBuffer));
            
            if(decodedImage){
                this.cachedImage?.delete();
                this.cachedImage = decodedImage;
                console.log(`Image Loaded: ${url}`)
            }
        } catch (error) {
            if(this.destroyed) return;
            console.error("Error al cargar la imagen del plugin:", error);
        }
    }

    onDestroy() {
        this.destroyed = true;
        this.loadToken++;
        if(this.cachedImage){
            this.cachedImage.delete();
            this.cachedImage = null;
        }
    }
}