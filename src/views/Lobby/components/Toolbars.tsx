import { userData } from "../../../models/userStore";
import recent_ico from "../../../assets/recent.svg";
import myLogo from "../../../assets/NodusLogo.png";
import style from "../Lobby.module.css";

export const CREATE_FLOW = (onCreate : () => void, onJoin: () => void) => {
    return (
        <div class={style.createFlow}>
            <button onClick={onCreate} id={style.newFlow}>New Flow</button>
            <label class={style.labelInfo}>- OR -</label>
            <label class={style.inputLabel}>ENTER ROOM ID</label>
            <input type="text" id={style.roomIdInput} maxLength={"10"} minLength={"10"}/>
            <button onClick={onJoin} id={style.join}>Join by ID</button>
        </div>
    )
}

export const USERNAME_INPUT = (onChange: () => void) => {
    return (
        <input type="text" id={style.usernameInput} placeholder="ENTER NAME..." onInput={onChange} value={userData.name}/>
    )
}

export const COPYRIGHT = () => {
    return (<p class={style.copyright}>
                Copyright © Bello's Projects 2026
            </p>
    )
}

export const RECENT_USED = (onClick: () => void) => {
    return ( userData.lastRoom && (
        <div class={style.recentUsed} onClick={onClick}>
            <div class={style.innerRecentUsed}>
                <img src={recent_ico} alt="recent-ico" />
                <p>RESUME LAST</p>
            </div>
            <p id={style.roomIdRecent}>Room ID: {userData.lastRoom}</p>
        </div>
    ));
}

export const HEADER = () => {
    return (
        <div style={{display: "flex", "align-items": "center"}}>
            <img src={myLogo} alt="alt" width={"30px"} height={"26px"} />
            <h1>Nodus Flow</h1>
        </div>
    )
}