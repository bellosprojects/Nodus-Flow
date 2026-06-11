import styles from "../Editor.module.css";
import { mouseDisabled, setIsCommandPaletteOpen  } from "../Editor";

import searchIco from "../../../assets/search.svg";
import { Accessor, createEffect, createMemo, createSignal, For } from "solid-js";
import { jumpToNode, nodes } from "../../../models/nodes";
import { exportDiagramAsPng } from "../../../core/renderer";
import { exportAsJson } from "../../../models/userStore";
import { nodusCanvas } from "../../../core/NodusCanvas";
import { calculateDiagramBounds } from "../../../utils/path";
import { addNodePropertyFromQuery, connectGraph, createNodesFromCommand, deleteFromQuery, deleteNodePropertyFromQuery, addConnectionPropertyFromQuery, deleteConnectionPropertyFromQuery, importFromQuery } from "../../../utils/commands";

export const [activeIndex, setActiveIndex] = createSignal(0);
export const [searchQuery, setSearchQuery] = createSignal("");

export type OmniItem = {
    id: string,
    label: string,
    type: 'NODE' | 'COMMAND',
    action: (arg?: string) => void,
    color?: string,
    argPlaceholder?: string
}

enum CommandID {
    ExportPng = "EXPORT_PNG",
    ExportJson = "EXPORT_JSON",
    ImportJson = "IMPORT_JSON",
    DelSelectedNodes = "DEL_SELECTED_NODES",
    DelAllConnections = "DEL_ALL_CONNECTIONS",
    DelAllNodes = "DEL_ALL_NODES",
    DelAllDisconnected = "DEL_ALL_DISCONNECTED",
    DelNode = "DEL_NODENAME",
    ResetView = "RESET_VIEW",
    ClearCanvas = "CLEAR_CANVAS",
    LockAll = "LOCK_ALL",
    UnLockAll = "UNLOCK_ALL",
    Deseclect = "SELECT_NONE",
    SelectAll = "SELECT_ALL",
    InverstSelect = "SELECT_INVERT",
    CreateNode = "CREATE_NODE",
    ConnectComplete = "CONNECT_COMPLETE",
    ConnectCircuit = "CONNECT_CIRCUIT",
    AddNodeProperty = "ADD_NODE_PROPERTY",
    DelNodeProperty = "DEL_NODE_PROPERTY",
    AddConnectionProperty = "ADD_CONNECTION_PROPERTY",
    DelConnectionProperty = "DEL_CONNECTION_PROPERTY"
}

const COMMANDS_BASE: Record<CommandID, {label: string; action: (arg?: string) => void, color?: string, argPlaceholder?: string}> = {
    [CommandID.ExportPng]: {
        label: 'Export PNG: Default Scale',
        action: (arg?: string) => exportDiagramAsPng(arg),
        color: "#977e2c"
    },
    [CommandID.ExportJson]: {
        label: 'Export: JSON',
        action: (_?: string) => exportAsJson(),
        color: "#97572c"
    },
    [CommandID.ImportJson]: {
        label: 'Import: JSON',
        action: (_?: string) => {
            importFromQuery();
        },
        color: "#2c977e"
    },
    [CommandID.DelSelectedNodes]: {
        label: 'Delete: Selected Nodes',
        action: (_?: string) => {
            deleteFromQuery("Selected Nodes");
        },
        color: "#aa2f10"
    },
    [CommandID.DelAllNodes]: {
        label: 'Delete: All Nodes',
        action: (_?: string) => {
            deleteFromQuery("All Nodes");
        },
        color: "#aa2f10"
    },
    [CommandID.DelAllConnections]: {
        label: 'Delete: All Connections',
        action: (_?: string) => {
            deleteFromQuery("All Connections");
        },
        color: "#aa2f10"
    },
    [CommandID.DelAllDisconnected]: {
        label: 'Delete: All Disconnected',
        action: (_?: string) => {
            deleteFromQuery("All Disconnected");
        },
        color: "#aa2f10"
    },
    [CommandID.DelNode]: {
        label: 'Delete: NodeName',
        action: (arg?: string) => {
            deleteFromQuery(arg);
        },
        color: "#aa2f10",
        argPlaceholder: "NodeName"
    },
    [CommandID.ResetView]: {
        label: 'Center Camera',
        action: (_?: string) => {
            const bounds = calculateDiagramBounds([...nodes]);
            const diagramCenter = nodusCanvas.camera.getDiagramCenter();
            const zoom = Math.min(nodusCanvas.camera.zoomToFit(bounds.width, bounds.height), 1);
            const offset = nodusCanvas.camera.offsetToCenterPoint(diagramCenter.x, diagramCenter.y, zoom);
            nodusCanvas.camera.animateTo(offset.offsetX, offset.offsetY, zoom);
        },
        color: "#c1d3df"
    },
    [CommandID.ClearCanvas]: {
        label: 'Clear Canvas',
        action: (_?: string) => {
            deleteFromQuery("Clear Canvas");
        },
        color: "#9be28c"
    },
    [CommandID.LockAll]: {
        label: 'Lock All nodes',
        action: (_?: string) => {
            import("../../../core/actions").then(({ actionLockAllNodes }) => actionLockAllNodes());
        },
        color: "#252421"
    },
    [CommandID.UnLockAll]: {
        label: 'Unlock All nodes',
        action: (_?: string) => {
            import("../../../core/actions").then(({ actionUnlockAllNodes }) => actionUnlockAllNodes());
        },
        color: "#1a610c"
    },
    [CommandID.Deseclect]: {
        label: 'Select: None',
        action: (_?: string) => {
            import("../../../core/actions").then(({ actionSelectNone }) => actionSelectNone());
        },
        color: "#7c7c7c38"
    },
    [CommandID.SelectAll]: {
        label: 'Select: All',
        action: (_?: string) => {
            import("../../../core/actions").then(({ actionSelectAll }) => actionSelectAll());
        },
        color: "#096894"
    },
    [CommandID.InverstSelect]: {
        label: 'Select: Invert',
        action: (_?: string) => {
            import("../../../core/actions").then(({ actionInvertSelection }) => actionInvertSelection());
        },
        color: "#c796c9"
    },
    [CommandID.CreateNode]: {
        label: "Create Node: ",
        action: (arg?: string) => {
            createNodesFromCommand(arg);
        },
        color: "#456733",
        argPlaceholder: "[NewNodeName]"
    },
    [CommandID.ConnectComplete]: {
        label: "Connect: Complete",
        action: (_?:string) => {
            connectGraph("Complete");
        },
        argPlaceholder: "Complete"
    },
    [CommandID.ConnectCircuit]: {
        label: "Connect: Circuit",
        action: (_?:string) => {
            // TODO: Implementar conexión en circuito
        },
        argPlaceholder: "Circuit"
    },
    [CommandID.AddNodeProperty]: {
        label: "Add Node Property: ",
        action: (arg?: string) => {
            addNodePropertyFromQuery(arg);
        },
        argPlaceholder: "propertyName propertyValue?"
    },
    [CommandID.DelNodeProperty]: {
        label: "Delete Node Property: ",
        action: (arg?: string) => {
            deleteNodePropertyFromQuery(arg);
        },
        argPlaceholder: "propertyName"
    },
    [CommandID.AddConnectionProperty]: {
        label: "Add Connection Property: ",
        action: (arg?: string) => {
            addConnectionPropertyFromQuery(arg);
        },
        argPlaceholder: "fromNodeName toNodeName propertyName propertyValue?"
    },
    [CommandID.DelConnectionProperty]: {
        label: "Delete Connection Property: ",
        action: (arg?: string) => {
            deleteConnectionPropertyFromQuery(arg);
        },
        argPlaceholder: "fromNodeName toNodeName propertyName"
    }
}

export const filteredItems = createMemo(() => {
    let q = searchQuery().trim();
    if(q.length === 0) return [];

    if(q[0] === '>'){

        const full = q.substring(1).trim();
        const parts = full.split(':');
        const cmdQuery = parts[0].trim().toLowerCase();
        const arg = parts.slice(1).join(':').trim();

        const cmdItems: OmniItem[] = Object.entries(COMMANDS_BASE).map(([id, cmd]) => {
            // base label is the part before any ':' in the command definition
            const baseLabel = (cmd.label || '').split(':')[0].trim();
            const displayLabel = arg ? `${baseLabel}: ${arg}` : `${cmd.label}${cmd.argPlaceholder || ''}`;

            return ({
                id,
                label: displayLabel,
                type: 'COMMAND',
                action: () => {

                    const procesedArg = arg || cmd.argPlaceholder;

                    console.log(`Executing Command: ${baseLabel}(${procesedArg})`)

                    cmd.action(procesedArg);
                },
                color: cmd.color
            });
        });

        //Quitar repetidos
        const whitoutRepeatsCmdItems : OmniItem[] = [];

        cmdItems.forEach(item => {
            if(whitoutRepeatsCmdItems.every(i => i.label !== item.label)) whitoutRepeatsCmdItems.push(item);
        });

        // match against the base command name or full label
        return whitoutRepeatsCmdItems.filter(item => item.label.toLowerCase().includes(cmdQuery.toLowerCase()) || item.label.toLowerCase().includes(full.toLowerCase()));
    }

    const nodeItems: OmniItem[] = nodes.map(node => ({
        id: `node-${node.id}`,
        label: `Go to: ${node.title || "Empty"} - ${node.id}`,
        type: 'NODE',
        action: () => jumpToNode(node),
        color: node.color
    }));

    return nodeItems.filter(item => item.label.toLowerCase().includes(q));
});

export const onSelectedItem = (item?: OmniItem) => {

    if(item !== undefined){

        item.action();
        setSearchQuery("");
        setIsCommandPaletteOpen(false);
        setActiveIndex(0);

    }
}

export const COMMAND_PALETTE = () => {

    createEffect(() => {

        const items = filteredItems();

        if(activeIndex() >= items.length) setActiveIndex(items.length - 1);
    });

    return (

        <div
        class={styles.commandPalette}
        >
            <div class={styles.searchBar}>
                <img src={searchIco}/>
                <input type="text" 
                        autocomplete="off" 
                        autocorrect="off" 
                        autocapitalize="off" 
                        spellcheck="false" 
                        id="search" 
                        placeholder="Search objects by name..."
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}/>
            </div>

            <div class={styles.searchResults}>
                <For each={filteredItems()}>
                    {(item, index) => 
                    
                        SEARCH_ITEM(item, index)
                    }
                </For>
            </div>
        </div>

    );
}

const SEARCH_ITEM = (item: OmniItem, index: Accessor<number>) => {
    return (
        <div 
            id={item.id} 
            style={{"--node-color": item.color || "#444"}} 
            classList={{
                [styles.searchItem]: true, 
                [styles.selected]: index() == activeIndex()
            }} 
            onClick={(_) => onSelectedItem(item)} 
            onMouseEnter={() => { if(!mouseDisabled()) setActiveIndex(index) }}>
            {item.label}
        </div>
    )
}