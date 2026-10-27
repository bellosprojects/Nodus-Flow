import { API_URL, authStore } from "../models/authStore";

export type RoomVisibility = "private" | "shared" | "public";

export interface RoomSummary {
    id: string;
    name: string;
    updated_at: string | null;
    owner_id: string | null;
    owner_nickname: string | null;
    visibility: RoomVisibility;
    archived_at: string | null;
    role?: "owner" | "editor" | "viewer";
}

export interface RoomMember {
    user_id: string;
    nickname: string | null;
    joined_at: string;
    role: "owner" | "editor" | "viewer";
}

export interface BannedRoomMember {
    user_id: string;
    nickname: string | null;
    banned_at: string;
}

export interface RoomJoinRequest {
    user_id: string;
    nickname: string | null;
    status: "pending";
    created_at: string;
    updated_at: string;
}

export interface RoomActivity {
    id: number;
    actor_nickname: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
}

async function roomRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!authStore.token) {
        throw new Error("Please sign in again to manage rooms.");
    }

    let response: Response;
    try {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${authStore.token}`);
        headers.set("Content-Type", "application/json");
        response = await fetch(`${API_URL}${path}`, {
            ...init,
            headers
        });
    } catch {
        throw new Error("Could not reach the server. Check your connection and try again.");
    }

    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }
    if (!response.ok) {
        const detail = typeof data === "object" && data !== null && "detail" in data
            ? String(data.detail)
            : "Room request failed.";
        throw new Error(detail);
    }
    return data as T;
}

export async function listUserRooms(): Promise<RoomSummary[]> {
    const result = await roomRequest<{ rooms: RoomSummary[] }>("/rooms");
    return result.rooms;
}

export async function listPublicRooms(): Promise<RoomSummary[]> {
    const result = await roomRequest<{ rooms: RoomSummary[] }>("/rooms/public");
    return result.rooms;
}

export function createRoom(name: string, visibility: RoomVisibility): Promise<RoomSummary> {
    return roomRequest("/rooms", {
        method: "POST",
        body: JSON.stringify({ name, visibility })
    });
}

export function joinRoom(roomId: string): Promise<RoomSummary> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST" });
}

export function updateRoom(
    roomId: string,
    changes: { name?: string; visibility?: RoomVisibility }
): Promise<RoomSummary> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        body: JSON.stringify(changes)
    });
}

export async function listRoomMembers(roomId: string): Promise<{
    members: RoomMember[];
    banned_members: BannedRoomMember[];
}> {
    return roomRequest<{
        members: RoomMember[];
        banned_members: BannedRoomMember[];
    }>(
        `/rooms/${encodeURIComponent(roomId)}/members`
    );
}

export function addRoomMember(roomId: string, nickname: string): Promise<{
    user_id: string;
    nickname: string;
    role: "editor";
}> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/members`, {
        method: "POST",
        body: JSON.stringify({ nickname })
    });
}

export function removeRoomMember(roomId: string, userId: string): Promise<{ message: string }> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`, {
        method: "DELETE"
    });
}

export function updateRoomMemberRole(
    roomId: string,
    userId: string,
    role: "editor" | "viewer"
): Promise<{ user_id: string; role: "editor" | "viewer" }> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role })
    });
}

export function transferRoomOwnership(roomId: string, userId: string): Promise<{
    owner_id: string;
    owner_nickname: string | null;
    visibility: RoomVisibility;
}> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/transfer-ownership`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId })
    });
}

export function archiveRoom(roomId: string, archived: boolean): Promise<{ archived_at: string | null }> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ archived })
    });
}

export function deleteRoom(roomId: string): Promise<{ message: string }> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
}

export function requestRoomAccess(roomId: string): Promise<{ status: "pending" }> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/join-requests`, { method: "POST" });
}

export async function listRoomJoinRequests(roomId: string): Promise<RoomJoinRequest[]> {
    const result = await roomRequest<{ requests: RoomJoinRequest[] }>(
        `/rooms/${encodeURIComponent(roomId)}/join-requests`
    );
    return result.requests;
}

export function decideRoomJoinRequest(
    roomId: string,
    userId: string,
    decision: "approve" | "reject"
): Promise<{ status: "approved" | "rejected" }> {
    return roomRequest(`/rooms/${encodeURIComponent(roomId)}/join-requests/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify({ decision })
    });
}

export async function listRoomActivity(roomId: string): Promise<RoomActivity[]> {
    const result = await roomRequest<{ activity: RoomActivity[] }>(
        `/rooms/${encodeURIComponent(roomId)}/activity`
    );
    return result.activity;
}
