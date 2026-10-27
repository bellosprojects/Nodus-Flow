// ConfigPanel.tsx
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { nodes, selectedNodes } from "../../../../models/nodes";
import { connections } from "../../../../models/connections";
import { activeUsers, User, useUser } from "../../../../models/users";
import {
    userData,
    updateCurrentProjectName,
    updateCurrentRoomRole,
    updateRoomDetails
} from "../../../../models/userStore";
import { isConfigPanelOpen, setIsConfigPanelOpen } from "../../Editor";
import styles from "./ConfigPanel.module.css";

import deleteIcon from "../../../../assets/delete.svg";
import closeIcon from "../../../../assets/home.svg";
import { actionAddProjectProperty, actionDeleteProjectProperty } from "../../../../core/actions";
import {
    addRoomMember,
    decideRoomJoinRequest,
    listRoomActivity,
    listRoomJoinRequests,
    listRoomMembers,
    removeRoomMember,
    RoomActivity,
    BannedRoomMember,
    RoomJoinRequest,
    RoomMember,
    transferRoomOwnership,
    updateRoomMemberRole,
    updateRoom,
    RoomVisibility
} from "../../../../services/rooms";
import { showToast, ToastType } from "../../../../models/toast";

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
    "enableDataFlowMode",
    "showNodeLines"
];

export const ConfigPanel = () => {
    const [newPropKey, setNewPropKey] = createSignal("");
    const [newPropValue, setNewPropValue] = createSignal("");
    const [members, setMembers] = createSignal<RoomMember[]>([]);
    const [bannedMembers, setBannedMembers] = createSignal<BannedRoomMember[]>([]);
    const [joinRequests, setJoinRequests] = createSignal<RoomJoinRequest[]>([]);
    const [roomActivity, setRoomActivity] = createSignal<RoomActivity[]>([]);
    const [memberNickname, setMemberNickname] = createSignal("");
    const [newOwnerId, setNewOwnerId] = createSignal("");
    const [roomSettingsError, setRoomSettingsError] = createSignal("");
    const isOwner = () => userData.currentRoomOwnerId === useUser().id();
    const canEditRoom = () => userData.currentRoomRole === "owner" || userData.currentRoomRole === "editor";

    const refreshMembers = async () => {
        try {
            const result = await listRoomMembers(userData.roomId);
            setMembers(result.members);
            setBannedMembers(result.banned_members);
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not load room members.");
        }
    };

    const refreshRequests = async () => {
        try {
            setJoinRequests(await listRoomJoinRequests(userData.roomId));
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not load access requests.");
        }
    };

    const refreshActivity = async () => {
        try {
            setRoomActivity(await listRoomActivity(userData.roomId));
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not load room activity.");
        }
    };

    createEffect(() => {
        if (isConfigPanelOpen()) {
            void refreshActivity();
            if (isOwner()) {
                void refreshMembers();
                if (userData.currentRoomVisibility === "private") void refreshRequests();
            }
        }
    });

    const changeVisibility = async (visibility: RoomVisibility) => {
        setRoomSettingsError("");
        try {
            const room = await updateRoom(userData.roomId, { visibility });
            updateRoomDetails({
                owner_id: room.owner_id,
                owner_nickname: room.owner_nickname,
                visibility: room.visibility
            });
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not update room visibility.");
        }
    };

    const handleAddMember = async (event: Event) => {
        event.preventDefault();
        setRoomSettingsError("");
        try {
            await addRoomMember(userData.roomId, memberNickname().trim());
            setMemberNickname("");
            await refreshMembers();
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not add that nickname.");
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        setRoomSettingsError("");
        try {
            await removeRoomMember(userData.roomId, memberId);
            await refreshMembers();
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not remove the member.");
        }
    };

    const handleMemberRoleChange = async (memberId: string, role: "editor" | "viewer") => {
        setRoomSettingsError("");
        try {
            await updateRoomMemberRole(userData.roomId, memberId, role);
            await refreshMembers();
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not update the member role.");
        }
    };

    const handleReadmitMember = async (member: BannedRoomMember) => {
        if (!member.nickname) {
            setRoomSettingsError("This user has no nickname and cannot be readmitted by nickname.");
            return;
        }
        setRoomSettingsError("");
        try {
            await addRoomMember(userData.roomId, member.nickname);
            await refreshMembers();
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not readmit the member.");
        }
    };

    const handleJoinRequest = async (memberId: string, decision: "approve" | "reject") => {
        setRoomSettingsError("");
        try {
            await decideRoomJoinRequest(userData.roomId, memberId, decision);
            await Promise.all([refreshRequests(), refreshMembers()]);
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not update the access request.");
        }
    };

    const handleOwnershipTransfer = async () => {
        const target = members().find(member => member.user_id === newOwnerId());
        if (!target || !confirm(`Transfer ownership to ${target.nickname || "this member"}? You will lose owner permissions.`)) {
            return;
        }
        setRoomSettingsError("");
        try {
            const result = await transferRoomOwnership(userData.roomId, target.user_id);
            updateRoomDetails({
                owner_id: result.owner_id,
                owner_nickname: result.owner_nickname,
                visibility: result.visibility
            });
            updateCurrentRoomRole("editor");
            setNewOwnerId("");
        } catch (error) {
            setRoomSettingsError(error instanceof Error ? error.message : "Could not transfer room ownership.");
        }
    };
    
    // Estadísticas de objetos
    const stats = createMemo(() => ({
        totalNodes: nodes.length,
        lockedNodes: nodes.filter(n => n.lock).length,
        unlockedNodes: nodes.filter(n => !n.lock).length,
        totalConnections: connections.length,
        dashedConnections: connections.filter(c => c.properties?.dashed === "true").length,
        selectedNodes: selectedNodes().length,
    }));

    // Usuarios conectados (excluyendo al actual)
    const otherUsers = createMemo(() => 
        activeUsers.filter(u => u.user_id !== useUser().id())
    );

    // Propiedades de la sala (de userData)

    
    const roomProperties = () => {
        const props: RoomProperty[] = [];
        const { currentProjectProperties } = userData;
        Object.keys(currentProjectProperties).forEach(key => {
            props.push({ key, value: currentProjectProperties[key] });
        });
        return props;
    };

    const addProperty = () => {
        const key = newPropKey().trim();
        if (key === "") return;
        actionAddProjectProperty(key, newPropValue() || "true");
        setNewPropKey("");
        setNewPropValue("");
    };

    const deleteProperty = (key: string, currentValue: any) => {
        actionDeleteProjectProperty(key, currentValue);
    };

    const updateProperty = (key: string, value: string) => {
        actionAddProjectProperty(key, value);
    };

    // Colores para avatares de usuario
    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
    const formatActivityDetails = (details: Record<string, unknown>) => Object.entries(details)
        .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
        .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
        .join(" · ");

    let projectNameSnapshot = ""

    const projectNameFocus = () => {
        projectNameSnapshot = userData.currentProjectName;
    }

    const projectNameChange = (e: Event) => {
        updateCurrentProjectName((e.currentTarget as HTMLInputElement).value, false);
    }

    const updateRoomName = async (name: string) => {
        if (!isOwner()) return;
        try {
            const room = await updateRoom(userData.roomId, { name });
            updateCurrentProjectName(room.name, false);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Could not update the room name.", ToastType.ERROR);
        }
    };

    const projectNameBlur = (e:Event) => {
        const newProjectName = (e.currentTarget as HTMLInputElement).value;

        if(newProjectName !== projectNameSnapshot && isOwner()){
            void updateRoomName(newProjectName.trim());
            projectNameSnapshot = newProjectName;
        }

    }

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
                                onFocus={projectNameFocus}
                                onInput={projectNameChange}
                                onChange={projectNameChange}
                                onBlur={projectNameBlur}
                                placeholder="Enter project name..."
                                readonly={!isOwner()}
                            />
                        </section>

                        <section class={styles.section}>
                            <label class={styles.sectionLabel}>Room access</label>
                            <div class={styles.roomOwner}>Owner: <strong>{userData.currentRoomOwnerNickname || "Unknown"}</strong></div>
                            <div class={styles.roomOwner}>Your role: <strong>{userData.currentRoomRole || "Loading"}</strong></div>
                            <Show when={userData.currentRoomRole === "viewer"}>
                                <p class={styles.activityEmpty}>View-only access. You can pan and inspect the diagram but cannot edit it.</p>
                            </Show>
                            <div class={styles.roomOwner}>Room ID: <code>{userData.roomId}</code></div>
                            <label class={styles.accessLabel} for="room-visibility">Visibility</label>
                            <select
                                id="room-visibility"
                                class={styles.accessSelect}
                                value={userData.currentRoomVisibility}
                                disabled={!isOwner()}
                                onChange={(event) => void changeVisibility(event.currentTarget.value as RoomVisibility)}
                            >
                                <option value="private">Private — owner whitelist</option>
                                <option value="shared">Shared — join by ID</option>
                                <option value="public">Public — listed in the lobby</option>
                            </select>
                            <Show when={roomSettingsError()}>
                                <p class={styles.roomSettingsError}>{roomSettingsError()}</p>
                            </Show>
                        </section>

                        <Show when={isOwner()}>
                            <section class={styles.section}>
                                <label class={styles.sectionLabel}>Room members</label>
                                <form class={styles.addMemberForm} onSubmit={handleAddMember}>
                                    <input
                                        class={styles.memberInput}
                                        placeholder="Add or readmit by nickname"
                                        value={memberNickname()}
                                        onInput={(event) => setMemberNickname(event.currentTarget.value)}
                                        minlength={3}
                                        maxlength={24}
                                        required
                                    />
                                    <button class={styles.roomActionButton} type="submit">Add</button>
                                </form>
                                <div class={styles.roomMembers}>
                                    <For each={members()}>
                                        {(member) => (
                                            <div class={styles.roomMember}>
                                                <span class={styles.roomMemberName}>
                                                    {member.nickname || member.user_id}
                                                    <small>{member.role}</small>
                                                </span>
                                                <Show when={member.user_id !== userData.currentRoomOwnerId} fallback={<span class={styles.roomOwnerBadge}>Owner</span>}>
                                                    <select
                                                        class={styles.memberRoleSelect}
                                                        value={member.role}
                                                        onChange={(event) => void handleMemberRoleChange(
                                                            member.user_id,
                                                            event.currentTarget.value as "editor" | "viewer"
                                                        )}
                                                        aria-label={`Role for ${member.nickname || "member"}`}
                                                    >
                                                        <option value="editor">Editor</option>
                                                        <option value="viewer">Viewer</option>
                                                    </select>
                                                    <button
                                                        class={styles.removeMemberButton}
                                                        onClick={() => void handleRemoveMember(member.user_id)}
                                                        aria-label={`Remove and block ${member.nickname || "member"}`}
                                                    >
                                                        Block
                                                    </button>
                                                </Show>
                                            </div>
                                        )}
                                    </For>
                                </div>
                                <Show when={bannedMembers().length > 0}>
                                    <label class={styles.accessLabel}>Blocked members · readmission required</label>
                                    <div class={styles.roomMembers}>
                                        <For each={bannedMembers()}>
                                            {(member) => (
                                                <div class={styles.roomMember}>
                                                    <span>{member.nickname || member.user_id}</span>
                                                    <button
                                                        class={styles.roomActionButton}
                                                        onClick={() => void handleReadmitMember(member)}
                                                    >
                                                        Readmit
                                                    </button>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </section>

                            <Show when={userData.currentRoomVisibility === "private"}>
                                <section class={styles.section}>
                                    <label class={styles.sectionLabel}>Private access requests</label>
                                    <Show when={joinRequests().length > 0} fallback={<p class={styles.activityEmpty}>No pending requests.</p>}>
                                        <div class={styles.roomMembers}>
                                            <For each={joinRequests()}>
                                                {(joinRequest) => (
                                                    <div class={styles.roomMember}>
                                                        <span>{joinRequest.nickname || joinRequest.user_id}</span>
                                                        <div class={styles.memberActions}>
                                                            <button class={styles.roomActionButton} onClick={() => void handleJoinRequest(joinRequest.user_id, "approve")}>
                                                                Approve
                                                            </button>
                                                            <button class={styles.removeMemberButton} onClick={() => void handleJoinRequest(joinRequest.user_id, "reject")}>
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </section>
                            </Show>

                            <section class={styles.section}>
                                <label class={styles.sectionLabel}>Transfer ownership</label>
                                <select
                                    class={styles.accessSelect}
                                    value={newOwnerId()}
                                    onChange={(event) => setNewOwnerId(event.currentTarget.value)}
                                >
                                    <option value="">Select a room member</option>
                                    <For each={members().filter(member => member.user_id !== userData.currentRoomOwnerId)}>
                                        {(member) => <option value={member.user_id}>{member.nickname || member.user_id}</option>}
                                    </For>
                                </select>
                                <button
                                    class={styles.removeMemberButton}
                                    disabled={!newOwnerId()}
                                    onClick={() => void handleOwnershipTransfer()}
                                >
                                    Transfer ownership
                                </button>
                                <Show when={roomSettingsError()}>
                                    <p class={styles.roomSettingsError}>{roomSettingsError()}</p>
                                </Show>
                            </section>
                        </Show>

                        <section class={styles.section}>
                            <label class={styles.sectionLabel}>Room activity · last 90 days</label>
                            <Show when={roomActivity().length > 0} fallback={<p class={styles.activityEmpty}>No recent activity.</p>}>
                                <div class={styles.activityList}>
                                    <For each={roomActivity()}>
                                        {(activity) => (
                                            <div class={styles.activityItem}>
                                                <span>
                                                    <strong>{activity.actor_nickname}</strong> {activity.action.replace(/_/g, " ")}
                                                    <Show when={formatActivityDetails(activity.details)}>
                                                        <small>{formatActivityDetails(activity.details)}</small>
                                                    </Show>
                                                </span>
                                                <time>{new Date(activity.created_at).toLocaleString()}</time>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
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
                                                readonly={!canEditRoom()}
                                                onBlur={(e) => updateProperty(prop.key, e.currentTarget.value)}
                                                onChange={(e) => updateProperty(prop.key, e.currentTarget.value)}
                                            />
                                            <Show when={canEditRoom()}>
                                                <button
                                                    class={styles.deletePropBtn}
                                                    onClick={() => deleteProperty(prop.key, prop.value)}
                                                >
                                                    <img src={deleteIcon} alt="Delete" />
                                                </button>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                                
                                {roomProperties().length === 0 && (
                                    <div class={styles.emptyState}>No custom properties</div>
                                )}
                            </div>

                            {/* Add property form */}
                            <Show when={canEditRoom()}>
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
                            </Show>
                        </section>
                    </div>
                </div>
            </div>
        </Show>
    );
};