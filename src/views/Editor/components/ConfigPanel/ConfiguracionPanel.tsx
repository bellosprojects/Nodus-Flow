// ConfigPanel.tsx
import { For, Show, createMemo, createSignal } from "solid-js";
import { nodes, selectedNodes } from "../../../../models/nodes";
import { connections } from "../../../../models/connections";
import { activeUsers, User, useUser } from "../../../../models/users";
import { userData, updateCurrentProjectName, addCurrentProjectProperty, deleteCurrentProjectProperty } from "../../../../models/userStore";
import { isConfigPanelOpen, setIsConfigPanelOpen } from "../../Editor";
import styles from "./ConfigPanel.module.css";

import deleteIcon from "../../../../assets/delete.svg";
import closeIcon from "../../../../assets/home.svg";

// Tipos para propiedades de la sala
interface RoomProperty {
    key: string;
    value: any;
}

// Props sugeridas para autocompletar
const SUGGESTED_ROOM_PROPS = [
    "backgroundColor",
    "snapToGrid",
    "showHistory",
    "showCameraInfo",
    "version",
    "description",
    "tags"
];

export const ConfigPanel = () => {
    const [newPropKey, setNewPropKey] = createSignal("");
    const [newPropValue, setNewPropValue] = createSignal("");

    // Estadísticas de objetos
    const stats = createMemo(() => ({
        totalNodes: nodes.length,
        lockedNodes: nodes.filter(n => n.lock).length,
        unlockedNodes: nodes.filter(n => !n.lock).length,
        totalConnections: connections.length,
        dashedConnections: connections.filter(c => c.properties?.dashed === "true").length,
        selectedNodes: selectedNodes().length,
    }));

    console.log(useUser().id());
    console.log(activeUsers);

    // Usuarios conectados (excluyendo al actual)
    const otherUsers = createMemo(() => 
        activeUsers.filter(u => u.user_id !== useUser().id())
    );

    // Propiedades de la sala (de userData)

    
    const roomProperties = () => {
        const props: RoomProperty[] = [];
        const { currentProjectProperties } = userData;
        console.log("Memo ejecutado, propiedades:", currentProjectProperties);
        Object.keys(currentProjectProperties).forEach(key => {
            props.push({ key, value: currentProjectProperties[key] });
        });
        return props;
    };

    const addProperty = () => {
        const key = newPropKey().trim();
        if (key === "") return;
        addCurrentProjectProperty(key, newPropValue() || "true");
        setNewPropKey("");
        setNewPropValue("");
    };

    const deleteProperty = (key: string) => {
        deleteCurrentProjectProperty(key);
    };

    const updateProperty = (key: string, value: string) => {
        addCurrentProjectProperty(key, value);
    };

    // Colores para avatares de usuario
    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

    return (
        <Show when={isConfigPanelOpen()}>
            <div class={styles.overlay} onClick={() => setIsConfigPanelOpen(false)}>
                <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div class={styles.header}>
                        <h2 class={styles.title}>Configuration</h2>
                        <button class={styles.closeBtn} onClick={() => setIsConfigPanelOpen(false)}>
                            <img src={closeIcon} alt="Close" />
                        </button>
                    </div>

                    {/* Content */}
                    <div class={styles.content}>
                        {/* Project Name Section */}
                        <section class={styles.section}>
                            <label class={styles.sectionLabel}>Project Name</label>
                            <input
                                type="text"
                                class={styles.projectNameInput}
                                value={userData.currentProjectName}
                                onInput={(e) => updateCurrentProjectName(e.currentTarget.value, true)}
                                placeholder="Enter project name..."
                            />
                        </section>

                        {/* Statistics Section */}
                        <section class={styles.section}>
                            <label class={styles.sectionLabel}>Statistics</label>
                            <div class={styles.statsGrid}>
                                <div class={styles.statItem}>
                                    <span class={styles.statValue}>{stats().totalNodes}</span>
                                    <span class={styles.statLabel}>Total Nodes</span>
                                </div>
                                <div class={styles.statItem}>
                                    <span class={styles.statValue}>{stats().lockedNodes}</span>
                                    <span class={styles.statLabel}>Locked</span>
                                </div>
                                <div class={styles.statItem}>
                                    <span class={styles.statValue}>{stats().unlockedNodes}</span>
                                    <span class={styles.statLabel}>Unlocked</span>
                                </div>
                                <div class={styles.statItem}>
                                    <span class={styles.statValue}>{stats().totalConnections}</span>
                                    <span class={styles.statLabel}>Connections</span>
                                </div>
                                <div class={styles.statItem}>
                                    <span class={styles.statValue}>{stats().dashedConnections}</span>
                                    <span class={styles.statLabel}>Dashed</span>
                                </div>
                                <div class={styles.statItem}>
                                    <span class={styles.statValue}>{otherUsers().length + 1}</span>
                                    <span class={styles.statLabel}>Active Users</span>
                                </div>
                            </div>
                        </section>

                        {/* Connected Users Section */}
                        <section class={styles.section}>
                            <label class={styles.sectionLabel}>Connected Users</label>
                            <div class={styles.usersList}>
                                {/* Current user */}
                                <div class={styles.userItem}>
                                    <div class={styles.userAvatar} style={{ "background-color": "#4a4a4a" }}>
                                        {getInitials(useUser().name() || "")}
                                    </div>
                                    <div class={styles.userInfo}>
                                        <span class={styles.userName}>{useUser().name()}</span>
                                        <span class={styles.userBadge}>You</span>
                                    </div>
                                </div>

                                {/* Other users */}
                                <For each={otherUsers()}>
                                    {(user: User) => (
                                        <div class={styles.userItem}>
                                            <div class={styles.userAvatar} style={{ "background-color": user.color }}>
                                                {getInitials(user.nombre)}
                                            </div>
                                            <div class={styles.userInfo}>
                                                <span class={styles.userName}>{user.nombre}</span>
                                                <span class={styles.userCoords}>
                                                    ({Math.round(user.x)}, {Math.round(user.y)})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </For>

                                {otherUsers().length === 0 && (
                                    <div class={styles.emptyState}>No other users connected</div>
                                )}
                            </div>
                        </section>

                        {/* Room Properties Section */}
                        <section class={styles.section}>
                            <label class={styles.sectionLabel}>Room Properties</label>
                            
                            {/* Property list */}
                            <div class={styles.propertiesList}>
                                <For each={roomProperties()}>
                                    {(prop) => (
                                        <div class={styles.propertyRow}>
                                            <input
                                                type="text"
                                                class={styles.propertyKey}
                                                value={prop.key}
                                                readonly
                                                disabled
                                            />
                                            <input
                                                type="text"
                                                class={styles.propertyValue}
                                                value={prop.value}
                                                onBlur={(e) => updateProperty(prop.key, e.currentTarget.value)}
                                                onChange={(e) => updateProperty(prop.key, e.currentTarget.value)}
                                            />
                                            <button
                                                class={styles.deletePropBtn}
                                                onClick={() => deleteProperty(prop.key)}
                                            >
                                                <img src={deleteIcon} alt="Delete" />
                                            </button>
                                        </div>
                                    )}
                                </For>
                                
                                {roomProperties().length === 0 && (
                                    <div class={styles.emptyState}>No custom properties</div>
                                )}
                            </div>

                            {/* Add property form */}
                            <div class={styles.addPropertyForm}>
                                <input
                                    type="text"
                                    list="suggestedRoomProps"
                                    placeholder="Property key"
                                    value={newPropKey()}
                                    onInput={(e) => setNewPropKey(e.currentTarget.value)}
                                    class={styles.addPropInput}
                                />
                                <datalist id="suggestedRoomProps">
                                    <For each={SUGGESTED_ROOM_PROPS}>
                                        {(prop) => <option value={prop} />}
                                    </For>
                                </datalist>
                                <input
                                    type="text"
                                    placeholder="Property value"
                                    value={newPropValue()}
                                    onInput={(e) => setNewPropValue(e.currentTarget.value)}
                                    class={styles.addPropInput}
                                />
                                <button class={styles.addPropBtn} onClick={addProperty}>
                                    Add
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </Show>
    );
};