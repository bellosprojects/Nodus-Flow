import { createStore } from "solid-js/store";
import { sendEvent } from "../core/socket";


const savedName = localStorage.getItem("nodus_username") || "";
const roomId = localStorage.getItem("nodus_room_id") || "0000000000";
const lastUsedRoom = localStorage.getItem("last_used_room") || "";

const [userData, setUserData] = createStore({
    name: savedName,
    roomId: roomId,
    lastRoom: lastUsedRoom,
    currentProjectName: ''
});

export const updateUserName = (newName: string) => {
    setUserData("name", newName);
    localStorage.setItem("nodus_username", newName);
};

export const updateRoomId = (newRoomId: string) => {
    setUserData("roomId", newRoomId);
    localStorage.setItem("nodus_room_id", newRoomId);
    updateLastRoomUsed(newRoomId);
}

export const updateLastRoomUsed = (newRoomId: string) => {
    setUserData("lastRoom", newRoomId);
    localStorage.setItem("last_used_room", newRoomId);
};

export const updateCurrentProjectName = (newProjectName: string, send = true) => {
    setUserData("currentProjectName", newProjectName);

    if(send)
    sendEvent({
        'tipo': 'cambiar_nombre_proyecto',
        'nombre': newProjectName
    });
}

export { userData };