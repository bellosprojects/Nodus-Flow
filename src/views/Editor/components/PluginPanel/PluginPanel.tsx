import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { isCommandPaletteOpen, isPluginPanelOpen } from "../../Editor"
import styles from "./PluginPanel.module.css";
import { nodusPluginManager, PluginManifest, PluginView } from "../../../../plugins/plugins";
import { actionAddNodePropertyToSelected } from "../../../../core/actions";
import { PluginViewItem } from "./PluginView";
import { getNode, jumpToNode, setSelectedNodesIds } from "../../../../models/nodes";
import deleteIco from "../../../../assets/delete.svg";
import { hide } from "@tauri-apps/api/app";

const PluginCard = (manifest: PluginManifest, onClick: (manifest: PluginManifest) => void) => {
    
    const applyToSelectedNodes = () => {
        actionAddNodePropertyToSelected("pluginId", manifest.id);
    }

    return (
        <div 
        class={styles.manifest}
        onClick={(_) => onClick(manifest)}>
            <div class={styles.manifestDetailts}>
                <strong>{manifest.name}</strong>
                <span>{manifest.publisher}</span>
            </div>
            <button
                class={styles.applyPluginBtn}
                onClick={(_) => applyToSelectedNodes()}>
                Apply
            </button>
        </div>
    );
}

const InstaceCard = (instace: {view: PluginView, name: string, node: string}, onClick: (view: PluginView) => void) => {
    return (
        <div
        class={styles.instace}
        onClick={(_) => {
            onClick(instace.view);
            setSelectedNodesIds([instace.node]);
            jumpToNode(getNode(instace.node));
        }}
        >
            <div
                style={{
                    background: getNode(instace.node)?.color || '#ccc',
                    width: '8px',
                    height: '35px',
                    "border-radius": '2px',
                    "margin-right": '5px'
                }}
            />
            <div class={styles.instaceDetails}>
                <strong>{instace.name}</strong>
                <span>{getNode(instace.node)?.title || 'Untitled'}</span>
            </div>
            <img src={deleteIco} alt="" onClick={(_) => nodusPluginManager.destroyNodePlugin(instace.node)}/>
        </div>
    )
}

const NotPlugin = () => {
    return (
        <div class={styles.pluginCard}>
            <p>Not plugin selected.</p>
        </div>
    )
}

const PluginCompletedCard = (manifest: PluginManifest | null) => {
    
    if(!manifest) return NotPlugin();
    
    return (
        <div class={styles.pluginCard}>
            <h4>{manifest.name}</h4>
            <span class={styles.pluginIdentifier}>{manifest.id}</span>
            <span class={styles.publisher}>{manifest.publisher}</span>

            <p>Version: {manifest.version}</p>
            <p>Min NF version: {manifest.nodusVersion}</p>

            <strong>Tags</strong>
            <div class={styles.tags}>
                <For each={manifest.tags}>
                    {(tag) => 
                        <span>{tag}</span>
                    }
                </For>
            </div>

            <strong>Permissions</strong>
            <div class={styles.permissions}>
                <For each={manifest.permissions}>
                    {(permission) => 
                        <span>{permission}</span>
                    }
                </For>
            </div>

            <p>{manifest.description}</p>

            <strong>Usage Properties</strong>
            <div class={styles.properties}>
                <For each={Object.entries(manifest.usageProperties)}>
                    {([key, description]) => 
                        <span><strong>{key}: </strong> {description}</span>
                    }
                </For>
            </div>

        </div>
    );
}

export const PluginPanel = () => {

    const [selectedView, setSelectedView] = createSignal<'registered' | 'instanced'>('registered');
    const [selectedPlugin, setSelectedPlugin] = createSignal<PluginManifest | null>(null);
    const [selectedInstance, setSelectedInstace] = createSignal<PluginView | null>(null);

    const activeInstances = createMemo(() => {
        nodusPluginManager.getVersion();
        return nodusPluginManager.getActivedPluginsView()
    });

    const registeredPlugins  = createMemo(() => {
        nodusPluginManager.getVersion();
        return nodusPluginManager.getRegisteredPluginsManifest()
    });

    onCleanup(() => {
        setSelectedPlugin(null);
        setSelectedInstace(null);
    });

    return (

        <Show when={isPluginPanelOpen() && !isCommandPaletteOpen()}>

            <div class={styles.pluginPanel}>


                <div class={styles.pluginHeader}>

                    <h3>{selectedView() === 'registered' ? "Installed Plugins" : "Active Instances"}</h3>

                    <Show when={selectedView() === 'registered'}>

                            <div class={styles.manifestLists}>
                                <For each={registeredPlugins()}>
                                    {(plugin) => (
                                        PluginCard(plugin, (v) => setSelectedPlugin(v))
                                    )}
                                </For>
                            </div>
                    </Show>

                    <Show when={selectedView() === 'instanced'}>

                            <div class={styles.manifestLists}>
                                <For each={activeInstances()}>
                                    {(plugin) => (
                                        InstaceCard(plugin, (v) => setSelectedInstace(v))
                                    )}
                                </For>
                            </div>
                    </Show>

                    <button
                    class={styles.goToInstancesBtn}
                    onClick={(_) => setSelectedView(selectedView() === 'registered'? 'instanced' : 'registered')}
                    >
                        {selectedView() === 'registered'? "Instances" : "Plugins"}
                    </button>

                </div>

                <Show when={selectedView() === 'registered'}>

                    { PluginCompletedCard(selectedPlugin()) }

                </Show>

                <Show when={selectedView() === 'instanced'}>

                    <PluginViewItem plugin={selectedInstance()}/>

                </Show>


            </div>
        </Show>
    )
}