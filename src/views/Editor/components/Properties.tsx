import { Show } from "solid-js";
import { finalizeNodePosition, finalizeNodeSize, selectedNode, updateNodeColor, updateNodeOpacity, updateNodePosition, updateNodeRadius, updateNodeSize, updateNodoTitle } from "../../../models/nodes";

export const Properties = () => {

    return (
        <Show when={selectedNode()}>
            <div class="glass-panel right-toolbar properties-panel">
                <header>
                    <span class="property-title">Property</span>
                </header>

                <span class="property-object">Object: {selectedNode()!.id}</span>

                <section class="prop-section">
                    <label>Dimensions</label>
                    <div class="input-grid">
                        <div class="input-group">
                        <span class="unit">W</span>
                        <input 
                            type="number" 
                            value={Math.round(selectedNode()!.width)} 
                            onInput={(e) => updateNodeSize(selectedNode()!.id, +e.currentTarget.value, selectedNode()!.height)}
                            onChange={(_) => finalizeNodeSize(selectedNode()!.id)}
                            onBlur={(_) => finalizeNodeSize(selectedNode()!.id)}
                        />
                        </div>
                        <div class="input-group">
                        <span class="unit">H</span>
                        <input 
                            type="number" 
                            disabled
                            value={Math.round(selectedNode()!.height)} 
                            onInput={(e) => updateNodeSize(selectedNode()!.id, selectedNode()!.width, +e.currentTarget.value)}
                            onChange={(_) => finalizeNodeSize(selectedNode()!.id)} 
                            onBlur={(_) => finalizeNodeSize(selectedNode()!.id)}                       
                        />
                        </div>
                    </div>
                </section>

                <section class="prop-section">
                    <label>Coordenadas</label>
                    <div class="input-grid">
                        <div class="input-group">
                        <span class="unit">X</span>
                        <input 
                            type="number" 
                            value={Math.round(selectedNode()!.x)} 
                            onInput={(e) => updateNodePosition(selectedNode()!.id, (+e.currentTarget.value || 0) - selectedNode()!.x, 0)}
                            onChange={(_) => finalizeNodePosition(selectedNode()!.id)}
                            onBlur={(_) => finalizeNodePosition(selectedNode()!.id)}
                        />
                        </div>
                        <div class="input-group">
                        <span class="unit">Y</span>
                        <input 
                            type="number" 
                            value={Math.round(selectedNode()!.y)} 
                            onInput={(e) => updateNodePosition(selectedNode()!.id, 0, (+e.currentTarget.value || 0) - selectedNode()!.y)}
                            onChange={(_) => finalizeNodePosition(selectedNode()!.id)}      
                            onBlur={(_) => finalizeNodePosition(selectedNode()!.id)}                  
                        />
                        </div>
                    </div>
                </section>

                <section class="prop-section">
                    <label>Tag</label>
                    <div class="input-group">
                        <input type="text"
                        value={selectedNode()!.title || ""}
                        placeholder="Escribe un nombre..."
                        onInput={(e) => updateNodoTitle(selectedNode()!.id, e.currentTarget.value)}
                        style={{width: "100%", background: "transparent", border: "none", color: "white", outline: "none"}}/>
                    </div>
                </section>

                <section class="prop-section">
                    <label>Color</label>
                    <div class="input-group">
                        <input
                            type="color" 
                            value={selectedNode()!.color}
                            style={{width: "100%", border: "none", "border-radius": "8px"}}
                            onInput={(e) => updateNodeColor(selectedNode()!.id, e.currentTarget.value)}
                            />
                    </div>
                </section>
                <section class="prop-section">
                    <label>Opacity</label>
                    <div class="input-group">
                        <input type="range" 
                            min={"0"} max={"1"}
                            step={"0.01"} 
                            style={{width: "100%"}}
                            value={selectedNode()!.opacity}
                            onInput={(e) => updateNodeOpacity(selectedNode()!.id, parseFloat(e.currentTarget.value))}
                            />
                    </div>
                </section>
                <section class="prop-section">
                    <label>Radius</label>
                    <div class="input-group">
                        <input type="range"
                        min={"0"}
                        max={Math.min(selectedNode()!.height, selectedNode()!.width) / 2}
                        style={{width: "100%"}}
                        step={"1"}
                        value={selectedNode()!.radius}
                        onInput={(e) => updateNodeRadius(selectedNode()!.id, parseFloat(e.currentTarget.value))}
                        />
                    </div>
                </section>
            </div>
        </Show>
    );
};