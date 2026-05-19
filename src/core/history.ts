import { createSignal } from "solid-js";

interface HistoryItem {
    label: string;
    undo: () => void;
    redo: () => void;
}

const [undoStack, setUndoStack] = createSignal<HistoryItem[]>([]);
const [redoStack, setRedoStack] = createSignal<HistoryItem[]>([]);

export const pushAction = (action: HistoryItem) => {
    setUndoStack(prev => {
        const newStack = [...prev, action];

        if(newStack.length > 100) return newStack.slice(1);
        return newStack;
    });

    setRedoStack([]);
}

export const performUndo = () => {
    const history = undoStack();
    if(history.length === 0) return;

    const lastAction = history[history.length - 1];

    lastAction.undo();

    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastAction]);
}

export const performRedo = () => {
    const history = redoStack();
    if(history.length === 0) return;

    const lastAction = history[history.length - 1];

    lastAction.redo();

    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, lastAction]);
}

export const historyListeners = (e : KeyboardEvent) => {
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

export { undoStack, redoStack};