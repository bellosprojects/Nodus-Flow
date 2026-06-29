import { createSignal } from "solid-js";

interface HistoryItem {
    label: string;
    undo: () => void;
    redo: () => void;
}

const [undoStack, setUndoStack] = createSignal<HistoryItem[]>([]);
const [redoStack, setRedoStack] = createSignal<HistoryItem[]>([]);

let isTransactionActive = false;
let transactionLabel = "";
let transactionActions: HistoryItem[] = [];

export const startTransaction = (label: string) => {
    isTransactionActive = true;
    transactionLabel = label;
    transactionActions = [];
}

export const commitTransaction = () => {
    if(!isTransactionActive) return;
    isTransactionActive = false;

    if(transactionActions.length === 0) return;

    if(transactionActions.length === 1) {
        pushToStack(transactionActions[0]);
    } else {
        const actions = [...transactionActions];
        pushToStack({
            label: transactionLabel,
            undo: () => {
                for(let i = actions.length - 1; i >= 0; i--){
                    actions[i].undo();
                }
            },
            redo: () => {
                for(let i = 0; i < actions.length; i++){
                    actions[i].redo();
                }
            }
        });
    }

    transactionActions = [];
}

export const rollbackTransaction = () => {
    isTransactionActive = false;
    transactionActions = [];
}

export const pushAction = (action: HistoryItem) => {
    console.log("Registrado Evento", action.label);
    if(isTransactionActive){
        transactionActions.push(action);
    } else {
        pushToStack(action);
    }
}

export const pushToStack = (action: HistoryItem) => {


    setUndoStack(prev => {
        const newStack = [...prev, action];
        if(newStack.length > 100) return newStack.slice(1);
        return newStack;
    });
    setRedoStack([]);
}

let isUndoRedoInProgress = false;

export const performUndo = () => {
    if (isUndoRedoInProgress) return;
    isUndoRedoInProgress = true;
    
    try {
        const history = undoStack();
        if (history.length === 0) return;

        const lastAction = history[history.length - 1];
        lastAction.undo();

        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, lastAction]);
    } finally {
        isUndoRedoInProgress = false;
    }
};

export const performRedo = () => {
    if (isUndoRedoInProgress) return;
    isUndoRedoInProgress = true;
    
    try {
        const history = redoStack();
        if (history.length === 0) return;

        const lastAction = history[history.length - 1];
        lastAction.redo();

        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, lastAction]);
    } finally {
        isUndoRedoInProgress = false;
    }
};

export { undoStack, redoStack};