import { createStore } from "solid-js/store"

export enum ToastType {
    SUCCES = "SUCCES",
    ERROR = "ERROR",
    INFO = "INFO",
    PROCESSING = "PROCESSING"
}

export interface ToastAction {
    label: string,
    action: () => void,
}

export interface Toast {
    id: number,
    message: string,
    type: ToastType,
    onClick? : ToastAction
}

export const handleToastAction = async (toast: Toast) => {
    if(toast.onClick){
        await toast.onClick.action();
    }

    removeToast(toast.id);
}

const [toasts, setToasts] = createStore<Toast[]>([]);

export const showToast = (message: string, type: ToastType = ToastType.INFO, onClick? : ToastAction) => {
    const id = Date.now();
    const newToast : Toast = {
        id: id,
        message: message,
        type: type,
        onClick: onClick
    };

    setToasts([...toasts, newToast]);

    if (type != ToastType.PROCESSING){
        setTimeout(() => {
            removeToast(id);
        }, 4000);
    }

    return id;
};

export const removeToast = (id: number) => {
    setToasts(t => t.filter(toast => toast.id !== id));
};

export { toasts };