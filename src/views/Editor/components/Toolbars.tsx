import { addNode } from '../../../models/nodes';

import myLogo from "../../../assets/NodusLogo.png";
import selectIco from "../../../assets/select.svg";
import fullScreenIco from "../../../assets/fullscreen.svg";
import connectIco from "../../../assets/connect.svg";
import dragIco from "../../../assets/drag.svg";
import homeIco from "../../../assets/home.svg";
import toolIco from "../../../assets/tools.svg";

import { center } from '../../../utils/math';

import styles from "../Editor.module.css";

import { updateCurrentProjectName, userData } from '../../../models/userStore';

export const HEADER = () => {
    return (
        <div class="top-left-toolbar">

            <div class="glass-panel" id="options">
                <div class="separator" style={{background: "#BFBFBF"}}></div>
                <div class="separator" style={{background: "#BFBFBF"}}></div>
                <div class="separator" style={{background: "#BFBFBF"}}></div>
            </div>

            <img src={myLogo} alt="alt" width={"30px"} height={"26px"} />
            <h1>Nodus Flow</h1>
        </div>
    )
}

export const LEFT_TOOLBAR = (onFullScreen: () => void, onHome: (() => void)) => {
    return (
        <div class="glass-panel left-toolbar">
            <img src={homeIco} alt="" class="bar-item" onClick={onHome}/>
            <img src={toolIco} alt="" class="bar-item"/>
            <div class="separator" />
            <img src={selectIco} alt="" class="bar-item"/>
            <div class="square" onClick={() => {
                const point = center();
                addNode(point.x - 80, point.y - 40);
            }}></div>
            <img src={connectIco} alt="" class="bar-item"/>
            <img src={dragIco} alt="" class="bar-item"/>
            <div class="separator" />
            <img src={fullScreenIco} alt="" class="bar-item" onClick={onFullScreen}/>
        </div>
    )
}

export const USERS_PANEL = () => {

    return (
        <div class='top-right-panel'>
            <div class='users-panel' id='users'></div>
            <button id='share'>Share</button>
            <button id='export'>Export</button>
        </div>
    )

};

export const USER_AVATAR = (nombre: string, color: string) => {
    return (
        <div class='user-avatar' style={{"background-color": color}}>{nombre.substring(0,2).toUpperCase()}</div>
    )
}

export const PROJECT_NAME = () => {
    return (
        <div style={{display: "flex", gap: "20px"}}>
            Project Name:
            <input type="text" class={styles.invisibleInput} value={userData.currentProjectName} onInput={(e) => updateCurrentProjectName(e.currentTarget.value)}/>
        </div>
    )
}

export const ROOM_ID = () => {
    return (
        <p class={styles.roomId}>Room ID: {userData.roomId}</p>
    )
}