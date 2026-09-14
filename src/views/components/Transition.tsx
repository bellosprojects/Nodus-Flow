import { createSignal, Show } from "solid-js";
import styles from "./Transition.module.css";

export const [isAppLoading, setIsAppLoading] = createSignal(false);
export const [loadingAppMessage, setLoadingAppMessage] = createSignal("Inicializando...");

export const LOADER = () => {
    return (
        <Show when={isAppLoading()}>
            <div class={styles.overlay}>
                <div class={styles.spinner}></div>
                <p>{loadingAppMessage()}</p>
            </div>
        </Show>
    )
}