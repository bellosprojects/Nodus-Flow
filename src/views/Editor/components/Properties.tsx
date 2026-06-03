import { createSignal, For, Match, Show, Switch, createMemo } from "solid-js";
import { activeNode, finalizeNodePosition, finalizeNodeSize, showPropertiesPanel, updateNodeColor, updateNodeOpacity, updateNodePosition, updateNodeRadius, updateNodeSize, updateNodoTitle, changeNodeStyle, Node, addNodeProperty, deleteNodeProperty } from "../../../models/nodes";
import { isEditPanelOpen } from "../Editor";

import deleteIcon from "../../../assets/delete.svg";

import styles from "../Editor.module.css";
import { addConnectionProperty, Connection, connections, deleteConnectionProperty, selectedConnection, selectedConnectionId } from "../../../models/connections";

export const [propertiesView, setPropertiesView] = createSignal<"base" | "advanced">("base");

export const BaseProperties = (props: {node: Node}) => {

    const { node } = props;

    return (

        <>
            <section class="prop-section">
                <label>Dimensions</label>
                <div class="input-grid">
                    <div class="input-group">
                    <span class="unit">W</span>
                    <input 
                        type="number" 
                        value={Math.round(node.width)} 
                        onInput={(e) => updateNodeSize(node.id, +e.currentTarget.value, node.height)}
                        onChange={(_) => finalizeNodeSize(node.id)}
                        onBlur={(_) => finalizeNodeSize(node.id)}
                    />
                    </div>
                    <div class="input-group">
                    <span class="unit">H</span>
                    <input 
                        type="number" 
                        value={Math.round(node.height)} 
                        onInput={(e) => updateNodeSize(node.id, node.width, +e.currentTarget.value)}
                        onChange={(_) => finalizeNodeSize(node.id)} 
                        onBlur={(_) => finalizeNodeSize(node.id)}                       
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
                        value={Math.round(node.x)} 
                        onInput={(e) => updateNodePosition(node.id, (+e.currentTarget.value || 0) - node.x, 0)}
                        onChange={(_) => finalizeNodePosition(node.id)}
                        onBlur={(_) => finalizeNodePosition(node.id)}
                    />
                    </div>
                    <div class="input-group">
                    <span class="unit">Y</span>
                    <input 
                        type="number" 
                        value={Math.round(node.y)} 
                        onInput={(e) => updateNodePosition(node.id, 0, (+e.currentTarget.value || 0) - node.y)}
                        onChange={(_) => finalizeNodePosition(node.id)}      
                        onBlur={(_) => finalizeNodePosition(node.id)}                  
                    />
                    </div>
                </div>
            </section>

            <section class="prop-section">
                <label>Tag</label>
                <div class="input-group">
                    <input type="text"
                        autocomplete="off" 
                        autocorrect="off" 
                        autocapitalize="off" 
                        spellcheck="false" 
                        value={node.title || ""}
                        placeholder="Enter a name..."
                        onInput={(e) => updateNodoTitle(node.id, e.currentTarget.value)}
                        style={{width: "100%", background: "transparent", border: "none", color: "white", outline: "none"}}
                    />
                </div>
            </section>

            <section class="prop-section">
                <label>Color</label>
                <div class="input-group">
                    <input
                        type="color" 
                        value={node.color}
                        style={{width: "100%", border: "none", "border-radius": "8px"}}
                        onInput={(e) => updateNodeColor(node.id, e.currentTarget.value)}
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
                        value={node.opacity}
                        onInput={(e) => updateNodeOpacity(node.id, parseFloat(e.currentTarget.value))}
                    />
                </div>
            </section>
            <section class="prop-section">
                <label>Radius</label>
                <div class="input-group">
                        <input type="range"
                        min={"0"}
                        max={Math.min(node.height, node.width) / 2}
                        style={{width: "100%"}}
                        step={"1"}
                        value={node.radius}
                        onInput={(e) => updateNodeRadius(node.id, parseFloat(e.currentTarget.value))}
                    />
                </div>
            </section>

            <section class="prop-section">
                <label>Style</label>
                <div class="input-group">
                    <select value={node.style} 
                    onInput={(e) => changeNodeStyle(node.id, parseInt(e.currentTarget.value))} 
                    style={{width: "100%", background: "#1e1e1e", color: "white", border: "1px solid rgba(255,255,255,0.08)", "border-radius": "8px", padding: "6px"}}>
                        <option value={1}>Rectangle</option>
                        <option value={2}>Ellipse</option>
                        <option value={3}>Diamond</option>
                    </select>
                </div>
            </section>
        </>
    );

}

const AdvancedPropertiesAdder = (props: {nodeId: string}) => {

    const { nodeId } = props;
    const [newPropKey, setNewPropKey] = createSignal("");
    const [newPropValue, setNewPropValue] = createSignal("");

    const addProperty = () => {
        if (newPropKey().trim() === "") return;
        addNodeProperty(nodeId, newPropKey(), newPropValue());
        setNewPropKey("");
        setNewPropValue("");
    };

    const suggestedProps = [
        "underline", 
        "doubleBorder",
        "dashedBorder",
        "borderWidth",
        "dashedUnderline",
        "widespread",
        "textAbove", 
        "textBelow", 
        "textLeft",
        "textRight",
        "fontSize", 
        "textOffset", 
        "widespread",
        "textAboveColor", 
        "textBelowColor", 
        "textLeftColor",
        "textRightColor",
        "textAboveFontSize", 
        "textBelowFontSize",
        "textLeftFontSize",
        "textRightFontSize",
    ];

    return (
        <div class={styles.formAddProperty} style={{margin: "10px 0"}}>

            <input 
                type="text"
                list="suggestedProps"
                placeholder="Property Key"
                value={newPropKey()}
                onInput={(e) => setNewPropKey(e.currentTarget.value)}
                class={styles.inputAddProperty}
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
            />
            <datalist id="suggestedProps">
                {suggestedProps.map((prop) => (
                    <option value={prop} />
                ))}
            </datalist>
            <input
                type="text"
                placeholder="Property Value"
                value={newPropValue()}
                onInput={(e) => setNewPropValue(e.currentTarget.value)}
                class={styles.inputAddProperty}
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
            />

            <span>
                <button onClick={addProperty} style={{width: "100%", background: "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "4px 0", "border-radius": "4px", cursor: "pointer"}}>Add Property</button>
            </span>
        </div>
    );
}

export const AdvancedProperties = (props: {node: Node}) => {
    const { node } = props;

    return (
        <>

            <AdvancedPropertiesAdder nodeId={node.id} />

            <For each={Object.keys(node.properties)}>
                {(key) => (
                    <section class="prop-section">
                        <label>{key}</label>
                        <div class={styles.advancedPropertyRow}>
                            <input type="text"
                                autocomplete="off" 
                                autocorrect="off" 
                                autocapitalize="off" 
                                spellcheck="false" 
                                value={node.properties[key] ?? ""}
                                onInput={(e) => {
                                    const newValue = e.currentTarget.value;
                                    addNodeProperty(node.id, key, newValue);
                                }}
                                style={{width: "100%", background: "transparent", border: "none", color: "white", outline: "none"}}
                            />
                            <img src={deleteIcon} alt="Delete"
                                class={styles.deletePropertyIcon}
                                onClick={() => deleteNodeProperty(node.id, key)}
                            />
                        </div>
                    </section>
                )}
            </For>
        </>
    );
};

const ConnectionPropertiesAdder = (props: {connId: string}) => {

    const { connId } = props;
    const [newPropKey, setNewPropKey] = createSignal("");
    const [newPropValue, setNewPropValue] = createSignal("");

    const addProperty = () => {
        if (newPropKey().trim() === "") return;
        addConnectionProperty(connId, newPropKey(), newPropValue());
        setNewPropKey("");
        setNewPropValue("");
    };

    const SuggestedProps = [
        "label", 
        "dashed",
        "noFlow",
        "fromPoint",
        "toPoint",
        "thickness",
        "color",
        "fontSize",
        "labelPosition",
        "labelColor",
    ];

    return (
        <div class={styles.formAddProperty} style={{margin: "10px 0"}}>
            <input 
                type="text"
                list="suggestedConnectionProps"
                placeholder="Property Key"
                value={newPropKey()}
                onInput={(e) => setNewPropKey(e.currentTarget.value)}
                class={styles.inputAddProperty}
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
            />
            <datalist id="suggestedConnectionProps">
                {SuggestedProps.map((prop) => (
                    <option value={prop} />
                ))}
            </datalist>

            <input
                type="text"
                placeholder="Property Value"
                value={newPropValue()}
                onInput={(e) => setNewPropValue(e.currentTarget.value)}
                class={styles.inputAddProperty}
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
            />
            <span>
                <button onClick={addProperty} style={{width: "100%", background: "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "4px 0", "border-radius": "4px", cursor: "pointer"}}>Add Property</button>
            </span>
        </div>
    );
}

const ConnectionProperties = (props: {connID: string}) => {
    const { connID } = props;

    const conn = createMemo(() => selectedConnection());

    return (
        <Show when={conn()}>
            <div class={styles.formAddProperty} style={{margin: "10px 0"}}>
                
                <ConnectionPropertiesAdder connId={conn()!.id} />

                <For each={Object.keys(conn()!.properties ?? {})}>
                    {(key) => (
                        <section class="prop-section">
                            <label>{key}</label>
                            <div class={styles.advancedPropertyRow}>
                                <input type="text"
                                    autocomplete="off" 
                                    autocorrect="off" 
                                    autocapitalize="off" 
                                    spellcheck="false" 
                                    value={conn()!.properties[key] ?? ""}
                                    onInput={(e) => {
                                        const newValue = e.currentTarget.value;
                                        addConnectionProperty(conn()!.id, key, newValue);
                                    }}
                                    style={{width: "100%", background: "transparent", border: "none", color: "white", outline: "none"}}
                                />
                                <img src={deleteIcon} alt="Delete"
                                    class={styles.deletePropertyIcon}
                                    onClick={() => deleteConnectionProperty(conn()!.id, key)}
                                />
                            </div>
                        </section>
                    )}
                </For>
            </div>
        </Show>
    );
};

export const Properties = () => {

    const node = activeNode();

    return (
        <Show when={showPropertiesPanel() && isEditPanelOpen()}>
                <div class={styles.propertiesPanel}>
                    <header>
                        <span class="property-title">Properties Panel</span>
                    </header>

                    <Show when={selectedConnectionId() !== null}>
                        <ConnectionProperties connID={selectedConnectionId()!} />
                    </Show>

                    <Show when={selectedConnectionId() === null}>

                        <span class="property-object">Object: {node!.id}</span>

                        <div class={styles.propertiesToggler}>
                            <button 
                                class={propertiesView() === "base" ? styles.active : ""}
                                onClick={() => setPropertiesView("base")}
                            >
                                Basic
                            </button>
                            <button 
                                class={propertiesView() === "advanced" ? styles.active : ""}
                                onClick={() => setPropertiesView("advanced")}
                            >
                                Advanced
                            </button>
                        </div>

                        <div class={styles.propertiesScroll}>
                            <Switch>
                                <Match when={propertiesView() === "base"}>
                                    <BaseProperties node={node!} />
                                </Match>
                                <Match when={propertiesView() === "advanced"}>
                                    <AdvancedProperties node={node!} />
                                </Match>
                            </Switch>
                        </div>
                    </Show>
                </div>
        </Show>
    );
    
};