import { createStore } from "solid-js/store";

type MouseHandler = (e: MouseEvent) => void;

interface MouseState {
    onClick: MouseHandler,
    onMove: MouseHandler,
    onUp: MouseHandler
}

const [mouseEvents, setMouseEvents] = createStore<MouseState>({
    onClick: () => {},
    onMove: () => {},
    onUp: () => {}
});

export const setViewMouseHandlers = (handlers: Partial<MouseState>) => {
    setMouseEvents({
        onClick: handlers.onClick || (() => {}),
        onMove: handlers.onMove || (() => {}),
        onUp: handlers.onUp || (() => {})
    });
};

export { mouseEvents };