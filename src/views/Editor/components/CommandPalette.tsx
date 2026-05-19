import styles from "../Editor.module.css";
import { mouseDisabled, setIsCommandPaletteOpen  } from "../Editor";

import searchIco from "../../../assets/search.svg";
import { Accessor, createMemo, createSignal, For } from "solid-js";
import { deleteAllDisconnected, deleteNode, jumpToNode, lockNode, nodes, selectedNodesIds, setSelectedNodesIds, unLockNode } from "../../../models/nodes";
import { exportDiagramAsPng } from "../../../core/renderer";
import { connections, deleteConnection } from "../../../models/connections";
import { exportAsJson } from "../../../models/userStore";
import { nodusCanvas } from "../../../core/NodusCanvas";
import { calculateDiagramBounds } from "../../../utils/path";
import { performRedo, performUndo, redoStack, undoStack } from "../../../core/history";

export const [activeIndex, setActiveIndex] = createSignal(0);
export const [searchQuery, setSearchQuery] = createSignal("");

export type OmniItem = {
    id: string,
    label: string,
    type: 'NODE' | 'COMMAND',
    action: () => void,
    group: string,
    color?: string
}

enum CommandID {
    ExportPng = "EXPORT_PNG",
    ExportJson = "EXPORT_JSON",
    DelAllDisconnected = "DEL_ALL_DISCONNECTED",
    ResetView = "RESET_VIEW",
    ClearCanvas = "CLEAR_CANVAS",
    LockAll = "LOCK_ALL",
    UnLockAll = "UNLOCK_ALL",
    Deseclect = "SELECT_NONE",
    SelectAll = "SELECT_ALL",
    InverstSelect = "SELECT_INVERT",
    Undo = "UNDO",
    Redo = "REDO"
}

const COMMANDS_BASE: Record<CommandID, {label: string; action: () => void, color?: string}> = {
    [CommandID.ExportPng]: {
        label: 'Export: PNG',
        action: () => exportDiagramAsPng(),
        color: "#977e2c"
    },
    [CommandID.ExportJson]: {
        label: 'Export: JSON',
        action: () => exportAsJson(),
        color: "#97572c"
    },
    [CommandID.DelAllDisconnected]: {
        label: 'Delete Disconnected',
        action: () => {
            deleteAllDisconnected();
        },
        color: "#aa2f10"
    },
    [CommandID.ResetView]: {
        label: 'Center Camera',
        action: () => {
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
        action: () => {
            [...nodes].forEach(node => deleteNode(node.id));
            [...connections].forEach(conn => deleteConnection(conn.id));
        },
        color: "#9be28c"
    },
    [CommandID.LockAll]: {
        label: 'Lock All nodes',
        action: () => {
            [...nodes].forEach(node => lockNode(node.id));
        },
        color: "#252421"
    },
    [CommandID.UnLockAll]: {
        label: 'Unlock All nodes',
        action: () => {
            [...nodes].forEach(node => unLockNode(node.id));
        },
        color: "#1a610c"
    },
    [CommandID.Deseclect]: {
        label: 'Select: None',
        action: () => setSelectedNodesIds([]),
        color: "#7c7c7c38"
    },
    [CommandID.SelectAll]: {
        label: 'Select: All',
        action: () => setSelectedNodesIds([...nodes].map(it => it.id)),
        color: "#096894"
    },
    [CommandID.InverstSelect]: {
        label: 'Select: Invert',
        action: () => {
            const currentIds = selectedNodesIds();
            const invertedIds = [...nodes].filter(n => !currentIds.includes(n.id)).map(it => it.id);
            setSelectedNodesIds(invertedIds);
        },
        color: "#c796c9"
    },
    [CommandID.Undo]: {
        label: `Undo: ${undoStack()[0]?.label || ""}`,
        action: () => {
            performUndo();
        }
    },
    [CommandID.Redo]: {
        label: `Redo: ${redoStack()[0]?.label || ""}`,
        action: () => {
            performRedo();
        }
    }

}

export const filteredItems = createMemo(() => {
    let q = searchQuery().toLowerCase().trim();
    if(q.length === 0) return [];

    if(q[0] === '>'){

        q = q.substring(1);

        const cmdItems: OmniItem[] = Object.entries(COMMANDS_BASE).map(([id, cmd]) => ({
            id,
            label: cmd.label,
            type: 'COMMAND',
            action: cmd.action,
            group: 'Actions',
            color: cmd.color
        }));

        return cmdItems.filter(item => item.label.toLowerCase().includes(q));
    }

    const nodeItems: OmniItem[] = nodes.map(node => ({
        id: `node-${node.id}`,
        label: `Go to: ${node.title || "Empty"} - ${node.id}`,
        type: 'NODE',
        action: () => jumpToNode(node),
        group: 'Nodes',
        color: node.color
    }));

    return nodeItems.filter(item => item.label.toLowerCase().includes(q));
});

export const onSelectedItem = (item: OmniItem) => {
    item.action();
    setSearchQuery("");
    setIsCommandPaletteOpen(false);
    setActiveIndex(0);
}

export const COMMAND_PALETTE = () => {
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

    )
}

const SEARCH_ITEM = (item: OmniItem, index: Accessor<number>) => {
    return (
        <div 
            id={item.id} 
            style={{"--node-color": item.color || "#444"}} 
            classList={{
                [styles.searchItem]: true, 
                [styles.selected]: index() == activeIndex(),
                [styles.disableHover]: !mouseDisabled()
            }} 
            onClick={(_) => onSelectedItem(item)} 
            onMouseEnter={() => setActiveIndex(index)}>
            {item.label}
        </div>
    )
}