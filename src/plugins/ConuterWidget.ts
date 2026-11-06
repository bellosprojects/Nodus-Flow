import { PluginInstance, PluginContext, PluginManifest, PluginView, PluginListeners, PluginRender } from "./plugins";

export class CounterWidgetPlugin implements PluginInstance {
    private count = 0;
    private context : PluginContext | undefined;

    manifest : PluginManifest = { 
        id: 'com.nodus.counter-widget', 
        name: 'Counter', 
        version: '1.0.0',
        nodusVersion: '1.0.0',
        publisher: 'Nodus Flow',
        description: 'Muestra un contador simple inicializado en cero que aumenta en uno al tocar un boton',
        usageProperties: {
            initialCount: "Conteo inicial (Se guarda en el nodo)"
        },
        tags: ['counter', 'interactivity'],
        permissions: ['node']
    };

    view: PluginView = {
        renderView: (container: HTMLElement) => {
            const notConfig = document.createElement('p');
            notConfig.innerText = 'Este plugin no requiere configuracion';
            container.appendChild(notConfig);
        }
    };

    listeners: PluginListeners = {};

    render: PluginRender = {

        renderType: 'HTML',

        renderCanvas: (_, __) => {
            return null
        },

        renderHTML: (container: HTMLElement) => this.renderCounter(container)
    };

    onLoad(data: Record<string, any>, context: PluginContext) {
        this.count = data.initialCount || 0;
        this.context = context;
    }

    renderCounter(container: HTMLElement) {
        const wrapper = document.createElement('div');
        // El wrapper general no bloquea el mouse
        wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #ffffff; border-radius: 8px; pointer-events: none;';
        
        const label = document.createElement('span');
        label.textContent = `Clicks: ${this.count}`;
        
        const btn = document.createElement('button');
        btn.textContent = 'Sumar';
        // CLAVE: Solo el botón activa pointer-events: auto para capturar el clic y sumar
        btn.style.cssText = 'margin-top: 5px; padding: 4px 8px; cursor: pointer; pointer-events: auto;';
        
        btn.onclick = (e) => {
            e.stopPropagation(); // Evita que burbujee raro hacia el canvas si no es necesario
            this.count++;
            label.textContent = `Clicks: ${this.count}`;
            if(this.context?.nodeApi){
                this.context.nodeApi.updateProperty('initialCount', this.count);
            }
        };

        wrapper.appendChild(label);
        wrapper.appendChild(btn);
        container.appendChild(wrapper);
    }

    onDestroy() {
        // Limpieza de eventos si fuera necesario
    }
}