import { getCurrentWindow } from "@tauri-apps/api/window";
import { nodes, selectedNodesIds, setSelectedNodesIds, deleteNode } from "../models/nodes";
import { mousePos, setIsCommandPaletteOpen, setMouseDisables, setMouseOption } from "../views/Editor/Editor";
import { activeIndex, filteredItems, onSelectedItem, setActiveIndex, setSearchQuery } from "../views/Editor/components/CommandPalette";
import { activeUsers } from "../models/users";
import { userData } from "../models/userStore";
import { addPing } from "../models/ping";
import { connectionsByNode } from "../models/connections";
import { performRedo, performUndo } from "../core/history";

async function fullScreenEvent(e: KeyboardEvent){

    const appWindow = getCurrentWindow();

    if(e.key === 'F11'){
        const isFullScreen = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!isFullScreen);
    }
};

function deleteSelectedNodesEvent(e: KeyboardEvent){
    if(e.key === 'Delete'){
        selectedNodesIds().forEach(nodeID => {
            deleteNode(nodeID);
        });
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

        const color = activeUsers.find(u => u.nombre === userData.name)!.color;
        addPing(mousePos.x, mousePos.y, color, userData.name);
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

        setSearchQuery(`> ${filteredItems()[activeIndex()].label}`);

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
            setSelectedNodesIds([...nodes].map(node => node.id));
        } else if(e.key === 'd'){
            setSelectedNodesIds([]);
        } else if(e.key === 'i'){
            const currentIds = selectedNodesIds();
            const invertedIds = [...nodes].filter(n => !currentIds.includes(n.id)).map(it => it.id);
            setSelectedNodesIds(invertedIds);
        } else if(e.key === 'u'){
            setSelectedNodesIds([...nodes].filter(node => connectionsByNode(node.id).length === 0).map(node => node.id));
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
};

export const removeEditorKeyboardEvents = () => {
    window.removeEventListener('keydown', historyListeners);
    window.removeEventListener('keydown', deleteSelectedNodesEvent)
    window.removeEventListener('keydown', openCommandPaletteEvent);
    window.removeEventListener('keydown', pingEvent);
    window.removeEventListener('keydown', navigateCommandPaletteEvent);
    window.removeEventListener('keydown', mousesOptionEvents);
    window.removeEventListener('keydown', nodeSelectionsEvent); 
};

export const initializeGlobalKeyboardEvents = () => {
    window.addEventListener('keydown', fullScreenEvent);
};

export const removeGlobalKeyboardEvents = () => {
    window.removeEventListener('keydown', fullScreenEvent);
};