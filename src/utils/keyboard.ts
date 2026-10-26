import { getCurrentWindow } from "@tauri-apps/api/window";
import { nodes, selectedNodesIds, selectedNodes } from "../models/nodes";
import { mousePos, setIsCommandPaletteOpen, setIsEditPanelOpen, setIsLayersPanelOpen, setIsPRessedEspace, setMouseDisables, setMouseOption } from "../views/Editor/Editor";
import { activeIndex, filteredItems, onSelectedItem, setActiveIndex, setSearchQuery } from "../views/Editor/components/CommandPalette/CommandPalette";
import { activeUsers, useUser } from "../models/users";
import { addPing } from "../models/ping";
import { performRedo, performUndo } from "../core/history";
import { actionDeleteSelectedNodes, actionInvertSelection, actionSelectAll, actionSelectNone, actionSelectUnconnected } from "../core/actions";

async function fullScreenEvent(e: KeyboardEvent){

    const appWindow = getCurrentWindow();

    if(e.key === 'F11' || (e.key == 'f' && e.ctrlKey)){
        const isFullScreen = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!isFullScreen);
    }
};

const isTyping = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    return isTyping;
}

function deleteSelectedNodesEvent(e: KeyboardEvent){

    if(isTyping(e)) return;

    if(e.key === 'Delete' || e.key === 'Backspace'){
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

    if(isTyping(e)) return;

    if(e.key === 'p'){
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

    if(isTyping(e)) return;

    if(e.key === 'h'){
        e.preventDefault();
        setMouseOption('move');
    } else if(e.key === 'v'){
        e.preventDefault();
        setMouseOption('select');
    } else if(e.key === 'c'){
        e.preventDefault();
        setMouseOption('connect');
    }
}

function nodeSelectionsEvent(e: KeyboardEvent){

    if(e.ctrlKey || e.metaKey){

        e.preventDefault();

        if(e.key === 'a'){
            if (e.shiftKey) {
                actionSelectNone();
            } else {
                actionSelectAll();
            }
        } 
        
        else if(e.key === 'i'){
            actionInvertSelection();
        } 
        
        else if(e.key === 'u' && e.shiftKey){
            actionSelectUnconnected();
        }
    }
}

function extraShortCuts(e: KeyboardEvent){
    if(e.ctrlKey || e.metaKey){
        e.preventDefault();
        if(e.key === 'l'){
            setIsLayersPanelOpen(prev => !prev);
        } else if(e.key === 'p' && e.shiftKey){
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

function DetectKeysDown(e: KeyboardEvent){

    if(isTyping(e)) return;

    if(e.key === ' '){
        e.preventDefault();
        setIsPRessedEspace(true);
    }
}

function DetectKeysUp(e: KeyboardEvent){

    if(isTyping(e)) return;

    if(e.key === ' '){
        e.preventDefault();
        setIsPRessedEspace(false);
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

    window.addEventListener('keydown', DetectKeysDown);
    window.addEventListener('keyup', DetectKeysUp);
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

    window.removeEventListener('keydown', DetectKeysDown); 
    window.removeEventListener('keyup', DetectKeysUp); 
};

export const initializeGlobalKeyboardEvents = () => {
    window.addEventListener('keydown', fullScreenEvent);
};

export const removeGlobalKeyboardEvents = () => {
    window.removeEventListener('keydown', fullScreenEvent);
};