import { Show } from "solid-js";
import { activeNode, finalizeNodePosition, finalizeNodeSize, showPropertiesPanel, updateNodeColor, updateNodeOpacity, updateNodePosition, updateNodeRadius, updateNodeSize, updateNodoTitle } from "../../../models/nodes";
import { isEditPanelOpen } from "../Editor";

import styles from "../Editor.module.css";

export const Properties = () => {

    const node = activeNode();

    return (
        <Show when={showPropertiesPanel() && isEditPanelOpen() && node !== null}>
            <div class={styles.propertiesPanel}>
                <header>
                    <span class="property-title">Properties Panel</span>
                </header>

                <span class="property-object">Object: {node!.id}</span>

                <div class={styles.propertiesScroll}>

                    <section class="prop-section">
                        <label>Dimensions</label>
                        <div class="input-grid">
                            <div class="input-group">
                            <span class="unit">W</span>
                            <input 
                                type="number" 
                                value={Math.round(node!.width)} 
                                onInput={(e) => updateNodeSize(node!.id, +e.currentTarget.value, node!.height)}
                                onChange={(_) => finalizeNodeSize(node!.id)}
                                onBlur={(_) => finalizeNodeSize(node!.id)}
                            />
                            </div>
                            <div class="input-group">
                            <span class="unit">H</span>
                            <input 
                                type="number" 
                                value={Math.round(node!.height)} 
                                onInput={(e) => updateNodeSize(node!.id, node!.width, +e.currentTarget.value)}
                                onChange={(_) => finalizeNodeSize(node!.id)} 
                                onBlur={(_) => finalizeNodeSize(node!.id)}                       
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
                                value={Math.round(node!.x)} 
                                onInput={(e) => updateNodePosition(node!.id, (+e.currentTarget.value || 0) - node!.x, 0)}
                                onChange={(_) => finalizeNodePosition(node!.id)}
                                onBlur={(_) => finalizeNodePosition(node!.id)}
                            />
                            </div>
                            <div class="input-group">
                            <span class="unit">Y</span>
                            <input 
                                type="number" 
                                value={Math.round(node!.y)} 
                                onInput={(e) => updateNodePosition(node!.id, 0, (+e.currentTarget.value || 0) - node!.y)}
                                onChange={(_) => finalizeNodePosition(node!.id)}      
                                onBlur={(_) => finalizeNodePosition(node!.id)}                  
                            />
                            </div>
                        </div>
                    </section>

                    <section class="prop-section">
                        <label>Tag</label>
                        <div class="input-group">
                            <input type="text"
                                id="tag"
                                autocomplete="off" 
                                autocorrect="off" 
                                autocapitalize="off" 
                                spellcheck="false" 
                                value={node!.title || ""}
                                placeholder="Enter a name..."
                                onInput={(e) => updateNodoTitle(node!.id, e.currentTarget.value)}
                                style={{width: "100%", background: "transparent", border: "none", color: "white", outline: "none"}}
                            />
                        </div>
                    </section>

                    <section class="prop-section">
                        <label>Color</label>
                        <div class="input-group">
                            <input
                                type="color" 
                                value={node!.color}
                                style={{width: "100%", border: "none", "border-radius": "8px"}}
                                onInput={(e) => updateNodeColor(node!.id, e.currentTarget.value)}
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
                                value={node!.opacity}
                                onInput={(e) => updateNodeOpacity(node!.id, parseFloat(e.currentTarget.value))}
                            />
                        </div>
                    </section>
                    <section class="prop-section">
                        <label>Radius</label>
                        <div class="input-group">
                                <input type="range"
                                min={"0"}
                                max={Math.min(node!.height, node!.width) / 2}
                                style={{width: "100%"}}
                                step={"1"}
                                value={node!.radius}
                                onInput={(e) => updateNodeRadius(node!.id, parseFloat(e.currentTarget.value))}
                            />
                        </div>
                    </section>
                </div>
            </div>
        </Show>
    );
};