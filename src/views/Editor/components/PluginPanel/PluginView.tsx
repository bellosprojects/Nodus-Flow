import { onCleanup, onMount, Show } from "solid-js";
import { PluginView } from "../../../../plugins/plugins";
import styles from "./PluginPanel.module.css";

const NotInstance = () => {
    return (
        <div class={styles.pluginView}>
            <p>Not instaced selected.</p>
        </div>
    )
}

const PluginViewHost = (props: {plugin: PluginView | null}) => {

    let containerRef : HTMLDivElement | undefined;

    onMount(() => {
        if(!containerRef) return;

        const shadow = containerRef.attachShadow({mode: 'open'});

        const pluginRoot = document.createElement('div');
        pluginRoot.style.width = '100%';
        pluginRoot.style.height = '100%';
        shadow.appendChild(pluginRoot);

        props.plugin?.renderView(pluginRoot);

    });

    onCleanup(() => {
        props.plugin?.onViewClose?.();
    });

    return (
        <div
            ref={containerRef}
            class={styles.pluginView}
        />
    )
}

export const PluginViewItem = (props: { plugin: PluginView | null}) => {
    return (
        <Show when={props.plugin} keyed fallback={NotInstance()}>
            {(plugin) => <PluginViewHost plugin={plugin} />}
        </Show>
    )
}