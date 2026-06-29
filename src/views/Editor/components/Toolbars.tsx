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

import styles from "../Editor.module.css";

import { Show } from 'solid-js';

import { 
    exportedMousePos,
    isCommandPaletteOpen, 
    isConfigPanelOpen, 
    isEditPanelOpen, 
    isLayersPanelOpen, 
    mouseOption, 
    setIsAutosavePAnelopen, 
    setIsCommandPaletteOpen, 
    setIsConfigPanelOpen, 
    setIsEditPanelOpen, 
    setIsLayersPanelOpen, 
    setMouseOption 
} from '../Editor';

import { nodusCanvas } from '../../../core/NodusCanvas';

import { 
    actionCreateNode
} from '../../../core/actions';


import {
    selectedNodes, 
    selectedNodesIds, 
    toolBeltPosition 
} from "../../../models/nodes";
import { redoStack, undoStack } from "../../../core/history";
import { userData } from "../../../models/userStore";


export const LEFT_TOOLBAR = (onFullScreen: () => void, onHome: (() => void)) => {
    return (
        <div class={styles.toolbar}>

            <img src={editIco} alt="" class={`${styles.barItem} ${isEditPanelOpen()? styles.selected : ""}`} onClick={(_) => setIsEditPanelOpen(prev => !prev)}/>

            <img src={layersIco} alt="" class={`${styles.barItem} ${isLayersPanelOpen()? styles.selected : ""}`} onClick={(_) => setIsLayersPanelOpen(prev => !prev)}/>

            <img src={terminalIco} alt="" class={`${styles.barItem} ${isCommandPaletteOpen()? styles.selected : ""}`} onClick={(_) => setIsCommandPaletteOpen(prev => !prev)}/>

            <div class={styles.separator} />

            <div class={styles.square} onClick={() => {
                const point = nodusCanvas.camera.getWorldCenter();
                actionCreateNode(point.x - 80, point.y - 40);
            }}></div>

            <img src={selectIco} alt="" class={`${styles.barItem} ${mouseOption() == 'select' ? styles.selected : ""}`} onClick={(_) => setMouseOption('select')}/>

            <img src={dragIco} alt="" class={`${styles.barItem} ${mouseOption() == 'move'? styles.selected : ""}`} onClick={(_) => setMouseOption('move')}/>

            <img src={connectIco} alt="" class={`${styles.barItem} ${mouseOption() == 'connect' ? styles.selected : ""}`} onClick={(_) => setMouseOption('connect')}/>

            <div class={styles.separator} />

            <img src={configIco} alt="" classList={{[styles.barItem]: true, [styles.selected]: isConfigPanelOpen()}} onClick={(_) => setIsConfigPanelOpen(prev => !prev)} />

            <img src={autosaveIco} alt="" class={styles.barItem} onClick={() => {
                setIsAutosavePAnelopen(prev => !prev);
            }} />
            
            <img src={fullScreenIco} alt="" class={styles.barItem} onClick={onFullScreen}/>

            <img src={homeIco} alt="" class={styles.barItem} onClick={onHome}/>


        </div>
    );
};

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
    );
};

export const LAST_ACTIONS = () => {

    const undoLabel = undoStack().length > 0? undoStack()[undoStack().length - 1].label : null;
    const redoLabel = redoStack().length > 0? redoStack()[redoStack().length - 1].label : null;

    return (
        <Show when={userData.currentProjectProperties.showHistory}>
            <div class={styles.lastActions}>
                <Show when={undoLabel}>
                    <span class={styles.action}>{`Undo: ${undoLabel}`}</span>
                </Show>
                <Show when={redoLabel}>
                    <span class={styles.action}>{`Redo: ${redoLabel}`}</span>
                </Show>
            </div>
        </Show>
    );
};

export const CURRENT_POSITION = () => {

    return (
        <Show when={userData.currentProjectProperties.showCameraInfo}>
            <div class={styles.position}>
                {`(${exportedMousePos().x.toFixed(0)},${exportedMousePos().y.toFixed(0)}) x${nodusCanvas.camera.zoom().toFixed(2)}`}
            </div>
        </Show>
    );
};