import { createStore } from "solid-js/store";

type MouseHandler = (e: MouseEvent) => void;

interface MouseState {
    onLeftClick: MouseHandler,
    onMove: MouseHandler,
    onUp: MouseHandler,
    onRightClick: MouseHandler
}

const [mouseEvents, setMouseEvents] = createStore<MouseState>({
    onLeftClick: () => {},
    onMove: () => {},
    onUp: () => {},
    onRightClick: () => {}
});

export const setViewMouseHandlers = (handlers: Partial<MouseState>) => {
    setMouseEvents({
        onLeftClick: handlers.onLeftClick || (() => {}),
        onMove: handlers.onMove || (() => {}),
        onUp: handlers.onUp || (() => {}),
        onRightClick: handlers.onRightClick || (() => {})
    });
};

export { mouseEvents };