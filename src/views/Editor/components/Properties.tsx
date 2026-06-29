import { createSignal, For, Match, Show, Switch, createMemo } from "solid-js";

import { 
    activeNode, 
    finalizeNodePosition, 
    finalizeNodeSize, 
    showPropertiesPanel, 
    updateNodeColor, 
    updateNodeOpacity, 
    updateNodePosition, 
    updateNodeRadius, 
    updateNodeSize, 
    updateNodoTitle, 
    changeNodeStyle, 
    Node, 
    addNodeProperty 
} from "../../../models/nodes";

import { isEditPanelOpen } from "../Editor";

import deleteIcon from "../../../assets/delete.svg";

import styles from "../Editor.module.css";
import { addConnectionProperty, selectedConnection, selectedConnectionId } from "../../../models/connections";

import { 
    actionUpdateNodeTitle, 
    actionUpdateNodeColor, 
    actionUpdateNodeOpacity, 
    actionUpdateNodeRadius, 
    actionChangeNodeStyle,
    actionSetNodeProperty,
    actionDeleteNodeProperty,
    actionSetConnectionProperty,
    actionDeleteConnectionProperty,
    actionFinalizeNodeResize,
    actionFinalizeNodeMove
} from "../../../core/actions";

export const [propertiesView, setPropertiesView] = createSignal<"base" | "advanced">("base");

// Variables para almacenar los valores antes del cambio
let widthSnapshot = 0;
let heightSnapshot = 0;
let xSnapshot = 0;
let ySnapshot = 0;

export const BaseProperties = (props: {node: Node}) => {
    const { node } = props;

    // Manejadores para Width
    const handleWidthFocus = () => {
        widthSnapshot = node.width;
    };

    const handleWidthChange = (e: Event) => {
        const newWidth = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newWidth)) return;
        updateNodeSize(node.id, newWidth, node.height);
    };

    const handleWidthBlur = (e: Event) => {
        const newWidth = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newWidth)) return;
        
        if (widthSnapshot !== newWidth) {
            actionFinalizeNodeResize(node.id, widthSnapshot, node.height, node.x, node.y);
        }
        finalizeNodeSize(node.id);
        widthSnapshot = 0;
    };

    // Manejadores para Height
    const handleHeightFocus = () => {
        heightSnapshot = node.height;
    };

    const handleHeightChange = (e: Event) => {
        const newHeight = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newHeight)) return;
        updateNodeSize(node.id, node.width, newHeight);
    };

    const handleHeightBlur = (e: Event) => {
        const newHeight = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newHeight)) return;
        
        if (heightSnapshot !== newHeight) {
            actionFinalizeNodeResize(node.id, node.width, heightSnapshot, node.x, node.y);
        }
        finalizeNodeSize(node.id);
        heightSnapshot = 0;
    };

    // Manejadores para X
    const handleXFocus = () => {
        xSnapshot = node.x;
    };

    const handleXChange = (e: Event) => {
        const newX = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newX)) return;
        updateNodePosition(node.id, newX - node.x, 0);
    };

    const handleXBlur = (e: Event) => {
        const newX = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newX)) return;
        
        if (xSnapshot !== newX) {
            actionFinalizeNodeMove(node.id, xSnapshot, node.y);
        }
        finalizeNodePosition(node.id);
        xSnapshot = 0;
    };

    // Manejadores para Y
    const handleYFocus = () => {
        ySnapshot = node.y;
    };

    const handleYChange = (e: Event) => {
        const newY = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newY)) return;
        updateNodePosition(node.id, 0, newY - node.y);
    };

    const handleYBlur = (e: Event) => {
        const newY = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(newY)) return;
        
        if (ySnapshot !== newY) {
            actionFinalizeNodeMove(node.id, node.x, ySnapshot);
        }
        finalizeNodePosition(node.id);
        ySnapshot = 0;
    };

    // Manejador para Title
    let titleSnapshot = "";
    const handleTitleFocus = () => {
        titleSnapshot = node.title || "";
    };

    const handleTitleChange = (e: Event) => {
        const newTitle = (e.target as HTMLInputElement).value;
        updateNodoTitle(node.id, newTitle);
    };

    const handleTitleBlur = (e: Event) => {
        const newTitle = (e.target as HTMLInputElement).value;
        console.log(`Nodo ${node.id}: Titulo Cambiado de ${titleSnapshot} a ${newTitle}`);
        if (titleSnapshot !== newTitle) {
            actionUpdateNodeTitle(node.id, titleSnapshot, newTitle);
        }
    };

    // Manejador para Color
    let colorSnapshot = "";
    const handleColorFocus = () => {
        colorSnapshot = node.color;
    };

    const handleColorChange = (e: Event) => {
        const newColor = (e.target as HTMLInputElement).value;
        updateNodeColor(node.id, newColor);
    };

    const handleColorBlur = (e: Event) => {
        const newColor = (e.target as HTMLInputElement).value;
        if (colorSnapshot !== newColor) {
            actionUpdateNodeColor(node.id, colorSnapshot, newColor);
        }
    };

    // Manejador para Opacity
    let opacitySnapshot = 0;
    const handleOpacityFocus = () => {
        opacitySnapshot = node.opacity;
    };

    const handleOpacityChange = (e: Event) => {
        const newOpacity = parseFloat((e.target as HTMLInputElement).value);
        updateNodeOpacity(node.id, newOpacity);
    };

    const handleOpacityBlur = (e: Event) => {
        const newOpacity = parseFloat((e.target as HTMLInputElement).value);
        if (opacitySnapshot !== newOpacity) {
            actionUpdateNodeOpacity(node.id, opacitySnapshot, newOpacity);
        }
    };

    // Manejador para Radius
    let radiusSnapshot = 0;
    const handleRadiusFocus = () => {
        radiusSnapshot = node.radius;
    };

    const handleRadiusChange = (e: Event) => {
        const newRadius = parseFloat((e.target as HTMLInputElement).value);
        updateNodeRadius(node.id, newRadius);
    };

    const handleRadiusBlur = (e: Event) => {
        const newRadius = parseFloat((e.target as HTMLInputElement).value);
        if (radiusSnapshot !== newRadius) {
            actionUpdateNodeRadius(node.id, radiusSnapshot, newRadius);
        }
    };

    // Manejador para Style
    let styleSnapshot = 0;
    const handleStyleFocus = () => {
        styleSnapshot = node.style;
    };

    const handleStyleChange = (e: Event) => {
        const newStyle = parseInt((e.target as HTMLInputElement).value);
        changeNodeStyle(node.id, newStyle);
    };

    const handleStyleBlur = (e: Event) => {
        const newStyle = parseInt((e.target as HTMLInputElement).value);
        if (styleSnapshot !== newStyle) {
            actionChangeNodeStyle(node.id, styleSnapshot, newStyle);
        }
    };

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
                            onFocus={handleWidthFocus}
                            onInput={handleWidthChange}
                            onBlur={handleWidthBlur}
                        />
                    </div>
                    <div class="input-group">
                        <span class="unit">H</span>
                        <input 
                            type="number" 
                            value={Math.round(node.height)} 
                            onFocus={handleHeightFocus}
                            onInput={handleHeightChange}
                            onBlur={handleHeightBlur}
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
                            onFocus={handleXFocus}
                            onInput={handleXChange}
                            onBlur={handleXBlur}
                        />
                    </div>
                    <div class="input-group">
                        <span class="unit">Y</span>
                        <input 
                            type="number" 
                            value={Math.round(node.y)} 
                            onFocus={handleYFocus}
                            onInput={handleYChange}
                            onBlur={handleYBlur}
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
                        onFocus={handleTitleFocus}
                        onInput={handleTitleChange}
                        onBlur={handleTitleBlur}
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
                        onFocus={handleColorFocus}
                        onInput={handleColorChange}
                        onBlur={handleColorBlur}
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
                        onFocus={handleOpacityFocus}
                        onInput={handleOpacityChange}
                        onBlur={handleOpacityBlur}
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
                        onFocus={handleRadiusFocus}
                        onInput={handleRadiusChange}
                        onBlur={handleRadiusBlur}
                        disabled={node.style !== 1}
                    />
                </div>
            </section>

            <section class="prop-section">
                <label>Style</label>
                <div class="input-group">
                    <select value={node.style} 
                        onFocus={handleStyleFocus}
                        onInput={handleStyleChange}
                        onBlur={handleStyleBlur}
                        class={styles.styleSelect}>
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
        actionSetNodeProperty(nodeId, newPropKey(), newPropValue() || "true");
        setNewPropKey("");
        setNewPropValue("");
    };

    const suggestedProps = [
        "underline", 
        "doubleBorder",
        "dashedBorder", 
        "borderWidth",
        "dashedUnderline",
        "disjointMembership",
        "overlappingMembership",
        "isSon",
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

    // Variables para snapshot de propiedades
    let propertySnapshots: Map<string, any> = new Map();

    const handlePropertyFocus = (key: string) => {
        propertySnapshots.set(key, node.properties[key] ?? "");
    };

    const handlePropertyChange = (key: string, e: Event) => {
        const newValue = (e.target as HTMLInputElement).value;
        addNodeProperty(node.id, key, newValue);
    };

    const handlePropertyBlur = (key: string, e: Event) => {
        const newValue = (e.target as HTMLInputElement).value;
        const oldValue = propertySnapshots.get(key);
        if (oldValue !== newValue) {
            actionSetNodeProperty(node.id, key, newValue);
        }
        propertySnapshots.delete(key);
    };

    const handleDeleteProperty = (key: string) => {
        actionDeleteNodeProperty(node.id, key);
    };

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
                                onFocus={() => handlePropertyFocus(key)}
                                onInput={(e) => handlePropertyChange(key, e)}
                                onBlur={(e) => handlePropertyBlur(key, e)}
                                style={{width: "100%", background: "transparent", border: "none", color: "white", outline: "none"}}
                            />
                            <img src={deleteIcon} alt="Delete"
                                class={styles.deletePropertyIcon}
                                onClick={() => handleDeleteProperty(key)}
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
        actionSetConnectionProperty(connId, newPropKey(), newPropValue() || "true");
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

const ConnectionProperties = () => {
    const conn = createMemo(() => selectedConnection());

    // Variables para snapshot de propiedades de conexión
    let propertySnapshots: Map<string, any> = new Map();

    const handlePropertyFocus = (key: string) => {
        if (!conn()) return;
        propertySnapshots.set(key, conn()!.properties?.[key] ?? "");
    };

    const handlePropertyChange = (key: string, e: Event) => {
        if (!conn()) return;
        const newValue = (e.target as HTMLInputElement).value;
        addConnectionProperty(conn()!.id, key, newValue);
    };

    const handlePropertyBlur = (key: string, e: Event) => {
        if (!conn()) return;
        const newValue = (e.target as HTMLInputElement).value;
        const oldValue = propertySnapshots.get(key);
        if (oldValue !== newValue) {
            actionSetConnectionProperty(conn()!.id, key, newValue);
        }
        propertySnapshots.delete(key);
    };

    const handleDeleteProperty = (key: string) => {
        if (!conn()) return;
        actionDeleteConnectionProperty(conn()!.id, key);
    };

    if (!conn()) return null;

    return (
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
                                onFocus={() => handlePropertyFocus(key)}
                                onInput={(e) => handlePropertyChange(key, e)}
                                onBlur={(e) => handlePropertyBlur(key, e)}
                                style={{width: "100%", background: "transparent", border: "none", color: "white", outline: "none"}}
                            />
                            <img src={deleteIcon} alt="Delete"
                                class={styles.deletePropertyIcon}
                                onClick={() => handleDeleteProperty(key)}
                            />
                        </div>
                    </section>
                )}
            </For>
        </div>
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
                    <ConnectionProperties/>
                </Show>

                <Show when={selectedConnectionId() === null && node}>
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