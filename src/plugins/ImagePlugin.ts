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
    private nodeApi?: PluginContext['nodeApi'];

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
        permissions: ['network', 'node']
    };

    view: PluginView = {
        renderView: (container: HTMLElement) => {

            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '5px';

            const title = document.createElement('h4');
            title.innerText = 'Image Renderer';
            title.style.textAlign = 'center';
            title.style.marginBottom = '10px';
            
            const urlLabel = document.createElement('p');
            urlLabel.innerText = 'Image URL:';
            urlLabel.style.marginLeft = '20px';
            urlLabel.style.marginBottom = '5px';

            const urlInput = document.createElement('input');
            urlInput.value = this.imageUrl;
            urlInput.style.width = 'calc(100% - 50px)';
            urlInput.style.marginLeft = '20px';
            urlInput.style.padding = '6px';
            urlInput.style.background = 'transparent';
            urlInput.style.border = 'none';
            urlInput.style.borderBottom = '1px solid #ccc';
            urlInput.style.color = '#eef';
            urlInput.style.transition = 'all ease .3s';
            urlInput.style.borderRadius = '4px 4px 0px 0px';
            
            urlInput.onfocus = (_) => {
                urlInput.style.outline = 'none';
                urlInput.style.background = 'rgba(255,255,255,0.05)';
            }            

            const previewLabel = document.createElement('p');
            previewLabel.innerText = 'Image Preview:';
            previewLabel.style.marginLeft = '20px';
            previewLabel.style.marginBottom = '5px';

            urlInput.onchange = (_) => {
                const newUrl = urlInput.value;
                this.imageUrl = newUrl;
                this.loadImage(newUrl);
                this.nodeApi?.updateProperty('imageUrl', newUrl);
            }

            const imagePreview = document.createElement('img');
            imagePreview.style.width = 'calc(100% - 100px)';
            imagePreview.style.marginLeft = '40px';
            imagePreview.src = this.imageUrl;

            urlInput.oninput = (_) => {
                imagePreview.src = urlInput.value;
            }

            container.appendChild(title);
            container.appendChild(urlLabel);
            container.appendChild(urlInput);
            container.appendChild(previewLabel);
            container.appendChild(imagePreview);
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
        this.nodeApi = context.nodeApi;

        this.imageUrl = data.imageUrl;
        if(!this.imageUrl) {
            if(context.nodeApi) {
                context.nodeApi.updateProperty('imageUrl', 'https://cdn-icons-png.flaticon.com/512/559/559907.png');
                this.imageUrl = 'https://cdn-icons-png.flaticon.com/512/559/559907.png';
            }
        }


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
            this.cachedImage?.delete();
            this.cachedImage = null;
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