import { getCurrentWindow } from "@tauri-apps/api/window";
import { nodes, selectedNodesIds, selectedNodes } from "../models/nodes";
import { mousePos, setIsCommandPaletteOpen, setIsEditPanelOpen, setIsLayersPanelOpen, setMouseDisables, setMouseOption } from "../views/Editor/Editor";
import { activeIndex, filteredItems, onSelectedItem, setActiveIndex, setSearchQuery } from "../views/Editor/components/CommandPalette/CommandPalette";
import { activeUsers, useUser } from "../models/users";
import { addPing } from "../models/ping";
import { performRedo, performUndo } from "../core/history";
import { actionDeleteSelectedNodes, actionInvertSelection, actionSelectAll, actionSelectNone, actionSelectUnconnected } from "../core/actions";

async function fullScreenEvent(e: KeyboardEvent){

    const appWindow = getCurrentWindow();

    if(e.key === 'F11'){
        const isFullScreen = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!isFullScreen);
    }
};

function deleteSelectedNodesEvent(e: KeyboardEvent){
    if(e.key === 'Delete'){
        actionDeleteSelectedNodes();
    }
}

function openCommandPaletteEvent(e: KeyboardEvent){
    if((e.ctrlKey || e.metaKey) && e.key === 'k'){
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        setSearchQuery("");
    } else if (e.key === 'Escape'){
        setIsCommandPaletteOpen(false);
    }
}

function pingEvent(e: KeyboardEvent){
    if(e.key === ' '){
        if(e.repeat) return;

        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if(isTyping) return;

        const color = activeUsers.find(u => u.nombre === useUser().name())!.color;
        addPing(mousePos.x, mousePos.y, color, useUser().name());
    }
}

function navigateCommandPaletteEvent(e: KeyboardEvent){

    const list = filteredItems();

    if (list.length === 0) return;

    if (e.key === "ArrowDown") {
        e.preventDefault();
        setMouseDisables(true);
        setActiveIndex((prev) => (prev + 1) % list.length);
        const el = document.getElementById(list[activeIndex()].id);
        el?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMouseDisables(true);
        setActiveIndex((prev) => (prev - 1 + list.length) % list.length);
        const el = document.getElementById(list[activeIndex()].id);
        el?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === "Enter") {
        onSelectedItem(list[activeIndex()]);
    } else if(e.key === "Tab"){
        e.preventDefault();

        if(activeIndex() >= filteredItems().length) return;

        let label = filteredItems()[activeIndex()].label;

        if(selectedNodesIds().length === 1){
            const selectedNode = nodes.find(n => n.id === selectedNodesIds()[0]);

            if(label.includes("NodeName")){
                label = label.replace("NodeName", selectedNode?.title || "NodeName");
            }
        } else if(selectedNodesIds().length > 1){
            label = label.replace("fromNodeName", selectedNodes()[0].title || "fromNodeName");
            label = label.replace("toNodeName", selectedNodes()[1].title || "toNodeName");
        }

        setSearchQuery(`> ${label}`);

    }
}

function mousesOptionEvents(e: KeyboardEvent){

    if(e.ctrlKey || e.metaKey){
        e.preventDefault();
        if(e.key === 'm'){
            setMouseOption('move');
        } else if(e.key === 's'){
            setMouseOption('select');
        } else if(e.key === 'c'){
            setMouseOption('connect');
        }
    }
}

function nodeSelectionsEvent(e: KeyboardEvent){

    if(e.ctrlKey || e.metaKey){
        e.preventDefault();
        if(e.key === 'a'){
            actionSelectAll();
        } else if(e.key === 'd'){
            actionSelectNone();
        } else if(e.key === 'i'){
            actionInvertSelection();
        } else if(e.key === 'u'){
            actionSelectUnconnected();
        }
    }
}

function extraShortCuts(e: KeyboardEvent){
    if(e.ctrlKey || e.metaKey){
        e.preventDefault();
        if(e.key === 'l'){
            setIsLayersPanelOpen(prev => !prev);
        } else if(e.key === 'p'){
            setIsEditPanelOpen(prev => !prev);
        }
    }
}

function historyListeners(e : KeyboardEvent){
    if(e.ctrlKey || e.metaKey){
        if(e.key === 'z'){
            e.preventDefault();
            performUndo();
        }
        if(e.key === 'y' || (e.shiftKey && e.key === 'z')){
            e.preventDefault();
            performRedo();
        }
    }
}

export const initializeEditorKeyboardEvents = () => {
    window.addEventListener('keydown', historyListeners);
    window.addEventListener('keydown', deleteSelectedNodesEvent)
    window.addEventListener('keydown', openCommandPaletteEvent);
    window.addEventListener('keydown', pingEvent);
    window.addEventListener('keydown', navigateCommandPaletteEvent);
    window.addEventListener('keydown', mousesOptionEvents);
    window.addEventListener('keydown', nodeSelectionsEvent);
    window.addEventListener('keydown', extraShortCuts);
};

export const removeEditorKeyboardEvents = () => {
    window.removeEventListener('keydown', historyListeners);
    window.removeEventListener('keydown', deleteSelectedNodesEvent)
    window.removeEventListener('keydown', openCommandPaletteEvent);
    window.removeEventListener('keydown', pingEvent);
    window.removeEventListener('keydown', navigateCommandPaletteEvent);
    window.removeEventListener('keydown', mousesOptionEvents);
    window.removeEventListener('keydown', nodeSelectionsEvent); 
    window.removeEventListener('keydown', extraShortCuts); 
};

export const initializeGlobalKeyboardEvents = () => {
    window.addEventListener('keydown', fullScreenEvent);
};

export const removeGlobalKeyboardEvents = () => {
    window.removeEventListener('keydown', fullScreenEvent);
};