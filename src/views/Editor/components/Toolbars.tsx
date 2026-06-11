import myLogo from "../../../assets/NodusLogo.png";
import selectIco from "../../../assets/select.svg";
import fullScreenIco from "../../../assets/fullscreen.svg";
import connectIco from "../../../assets/connect.svg";
import dragIco from "../../../assets/drag.svg";
import homeIco from "../../../assets/home.svg";
import editIco from "../../../assets/edit.svg";
import layersIco from "../../../assets/layers.svg";
import terminalIco from "../../../assets/terminal.svg";
import configIco from "../../../assets/settings.svg";
import autosaveIco from "../../../assets/autosave.svg";

import textIco from "../../../assets/text-adjust.svg";
import copyIco from "../../../assets/copy.svg";
import lockIco from "../../../assets/lock.svg";
import unLockIco from "../../../assets/unlock.svg";
import frontIco from "../../../assets/front.svg";
import backIco from "../../../assets/back.svg";
import deleteIco from "../../../assets/delete.svg";
import categoryIco from "../../../assets/category.svg";

import shareIco from "../../../assets/share.svg";
import downloadIco from "../../../assets/download.svg";

import styles from "../Editor.module.css";

import { For, Match, Show, Switch } from 'solid-js';

import { 
    isCommandPaletteOpen, 
    isConfigPanelOpen, 
    isEditPanelOpen, 
    isLayersPanelOpen, 
    layerView, 
    mouseOption, 
    setIsAutosavePAnelopen, 
    setIsCommandPaletteOpen, 
    setIsConfigPanelOpen, 
    setIsEditPanelOpen, 
    setIsLayersPanelOpen, 
    setLayerView, setMouseOption 
} from '../Editor';

import { activeUsers } from '../../../models/users';
import { exportDiagramAsPng } from '../../../core/renderer';
import { nodusCanvas } from '../../../core/NodusCanvas';

import { 
    actionChangeConnectionStyle, 
    actionCreateNode, 
    actionDeleteConnection, 
    actionToggleLockNodes, 
    actionUpdateProjectName 
} from '../../../core/actions';

import { userData, updateCurrentProjectName } from "../../../models/userStore";

import {
    getNode, 
    jumpToNode, 
    Node, 
    nodes, 
    ocupadoPor, 
    selectedNodes, 
    selectedNodesIds, 
    setSelectedNodesIds, 
    toolBeltPosition 
} from "../../../models/nodes";

import { Connection, connections, selectedConnectionId, setSelectedConnectionId } from "../../../models/connections";
import { AutosavePanel } from "./AutosavePanel";

export const HEADER = () => {
    return (
        <div class="top-left-toolbar">

            <div class="glass-panel" id="options">
                <div class="separator" style={{background: "#BFBFBF"}}></div>
                <div class="separator" style={{background: "#BFBFBF"}}></div>
                <div class="separator" style={{background: "#BFBFBF"}}></div>
            </div>

            <img src={myLogo} alt="alt" width={"30px"} height={"26px"} />
            <h1>Nodus Flow</h1>
        </div>
    )
}

export const LEFT_TOOLBAR = (onFullScreen: () => void, onHome: (() => void)) => {
    return (
        <div class="glass-panel left-toolbar">

            <img src={editIco} alt="" class={`${styles.barItem} ${isEditPanelOpen()? styles.selected : ""}`} onClick={(_) => setIsEditPanelOpen(prev => !prev)}/>

            <img src={layersIco} alt="" class={`${styles.barItem} ${isLayersPanelOpen()? styles.selected : ""}`} onClick={(_) => setIsLayersPanelOpen(prev => !prev)}/>

            <img src={terminalIco} alt="" class={`${styles.barItem} ${isCommandPaletteOpen()? styles.selected : ""}`} onClick={(_) => setIsCommandPaletteOpen(prev => !prev)}/>

            <div class="separator" />

            <div class="square" onClick={() => {
                const point = nodusCanvas.camera.getWorldCenter();
                actionCreateNode(point.x - 80, point.y - 40);
            }}></div>

            <img src={selectIco} alt="" class={`${styles.barItem} ${mouseOption() == 'select' ? styles.selected : ""}`} onClick={(_) => setMouseOption('select')}/>

            <img src={dragIco} alt="" class={`${styles.barItem} ${mouseOption() == 'move'? styles.selected : ""}`} onClick={(_) => setMouseOption('move')}/>

            <img src={connectIco} alt="" class={`${styles.barItem} ${mouseOption() == 'connect' ? styles.selected : ""}`} onClick={(_) => setMouseOption('connect')}/>

            <div class="separator" />

            <img src={configIco} alt="" classList={{[styles.barItem]: true, [styles.selected]: isConfigPanelOpen()}} onClick={(_) => setIsConfigPanelOpen(prev => !prev)} />

            <img src={autosaveIco} alt="" class={styles.barItem} onClick={() => {
                setIsAutosavePAnelopen(prev => !prev);
            }} />
            
            <img src={fullScreenIco} alt="" class={styles.barItem} onClick={onFullScreen}/>

            <img src={homeIco} alt="" class={styles.barItem} onClick={onHome}/>


        </div>
    )
}

export const USERS_PANEL = () => {

    return (
        <div class={styles.usersPanel}>
            <For each={activeUsers}>
                {(user) => USER_AVATAR(user.nombre, user.color)}
            </For>
        </div>
    )

};

export const USER_AVATAR = (nombre: string, color: string) => {
    return (
        <div class={styles.userAvatar} style={{"background-color": color}}>{nombre.substring(0,2).toUpperCase()}</div>
    )
}


export const TOP_BUTTONS = (onShare: () => void) => {
    return (
        <div class={styles.topButtons}>
            <img src={shareIco} alt="" onClick={onShare}/>
            <img src={downloadIco} alt="" onClick={(_) => exportDiagramAsPng(1)}/>
        </div>
    )
}

export const PROJECT_NAME = () => {
    return (
        <div class={styles.projectName}>
            <p>Project Name: </p>
            <input placeholder='Enter project name...' type="text" value={userData.currentProjectName} onInput={(e) => updateCurrentProjectName(e.currentTarget.value)} onBlur={(_) => actionUpdateProjectName(userData.oldProjectName, userData.currentProjectName)}/>
        </div>
    )
}

export const ROOM_ID = () => {
    return (
        <p class={styles.roomId}>Room ID: {userData.roomId}</p>
    )
}

export const TOOL_BELT = () => {
    // Importar las acciones necesarias
    const handleBulkFitHeight = () => {
        import("../../../core/actions").then(({ actionBulkFitHeight }) => actionBulkFitHeight());
    };
    
    const handleBulkCopy = () => {
        import("../../../core/actions").then(({ actionBulkCopy }) => actionBulkCopy());
    };
    
    const handleBulkToFront = () => {
        import("../../../core/actions").then(({ actionBulkToFront }) => actionBulkToFront());
    };
    
    const handleBulkToBack = () => {
        import("../../../core/actions").then(({ actionBulkToBack }) => actionBulkToBack());
    };
    
    const handleDeleteSelected = () => {
        import("../../../core/actions").then(({ actionDeleteSelectedNodes }) => actionDeleteSelectedNodes());
    };
    
    const handleToggleLock = () => {
        import("../../../core/actions").then(({ actionToggleLockNodes }) => {
            actionToggleLockNodes(selectedNodesIds(), !selectedNodes().every(n => n.lock));
        });
    };

    return (
        <Show when={selectedNodes().length > 0}>
            <div class={styles.toolBelt}
                style={{left: `${toolBeltPosition()?.x}px`,
                top: `${toolBeltPosition()?.y}px`}}>
                <div class={styles.toolBeltButton} data-tooltip="Fit height">
                    <img src={textIco} alt="" onClick={handleBulkFitHeight}/>
                </div>
                <div class={styles.toolBeltButton} data-tooltip="Copy">
                    <img src={copyIco} alt="" onClick={handleBulkCopy}/>
                </div>
                <div class={styles.toolBeltButton} data-tooltip={selectedNodes().some(node => node.lock) ? "Unlock" : "Lock"}>
                    <img src={selectedNodes().some(node => node.lock)? lockIco : unLockIco} alt="" onClick={handleToggleLock}/>
                </div>
                <div class={styles.toolBeltButton} data-tooltip="Bring to front">
                    <img src={frontIco} alt="" onClick={handleBulkToFront}/>
                </div>
                <div class={styles.toolBeltButton} data-tooltip="Send to back">
                    <img src={backIco} alt="" onClick={handleBulkToBack}/>
                </div>
                <div class={styles.toolBeltButton} data-tooltip="Delete">
                    <img src={deleteIco} alt="" onClick={handleDeleteSelected}/>
                </div>
            </div>
        </Show>
    )
}

export const LAYERS_PANEL = () => {
    return (
        <Show
            when={isLayersPanelOpen()}>
                <div class={styles.layersPanel}>
                    <div class={styles.layersLabels}>
                        <p classList={{[styles.layersTitle]: true, [styles.selected]: layerView() == 'nodes'}} onClick={(_) => setLayerView('nodes')}>Nodes</p>
                        <p classList={{[styles.layersTitle]: true, [styles.selected]: layerView() == 'connections'}} onClick={(_) => setLayerView('connections')}>Connections</p>
                    </div>
                    <div class={styles.layersList}>
                        
                        <Switch>
                            <Match when={layerView() == 'nodes'}>
                                <For each={nodes.slice().reverse()}>
                                    {(node) => 
                                        NODE_FRAME(node)
                                    }
                                </For>
                            </Match>

                            <Match when={layerView() == 'connections'}>
                                <For each={connections.slice().reverse()}>
                                    {(conn) => 
                                        CONN_FRAME(conn)
                                    }
                                </For>
                            </Match>
                        </Switch>
                    
                    </div>
                </div>
        </Show>
    )
}

const NODE_FRAME = (node: Node) => {
    return (
        <div class={`${styles.layerItem} ${selectedNodesIds().includes(node.id)? styles.selected: ""} `}
            onClick={(_) => jumpToNode(node)}
            >
                <img src={node.lock? lockIco : unLockIco} onClick={(_) => { if(!ocupadoPor(node.id)) { actionToggleLockNodes([node.id], !node.lock) }}}/>
                <span style={{"background-color": node.color}} class={styles.nodeFrameIco}></span>
                <p>{node.title?.substring(0, 18)}</p>
            </div>
    )
}

const CONN_FRAME = (conn: Connection) => {
    return (
        <div class={`${styles.layerItem} ${selectedConnectionId() === conn.id? styles.selected: ""} `}
            onClick={(_) => {setSelectedConnectionId(conn.id); setSelectedNodesIds([]); }}
            >
                <img src={deleteIco} onClick={(_) => actionDeleteConnection(conn.id) }/>
                <img src={categoryIco} onClick={(_) => { actionChangeConnectionStyle(conn.id, 1 + ((conn.tipo) % 7))}}/>
                <p>{`${getNode(conn.from)?.title || "Empty"} - ${getNode(conn.to)?.title || "Empty"}`}</p>
            </div>
    )
}