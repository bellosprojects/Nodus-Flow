import styles from "./Header.module.css";
import { For } from "solid-js";
import { activeUsers } from "../../../../models/users";
import shareIco from "../../../../assets/share.svg";
import downloadIco from "../../../../assets/download.svg";
import { exportDiagramAsPng } from "../../../../core/renderer";
import { userData } from "../../../../models/userStore";
import { updateCurrentProjectName } from "../../../../models/userStore";
import { actionUpdateProjectName } from "../../../../core/actions";
import { HEADER } from "../../../Lobby/components/Toolbars";

const USERS_PANEL = () => {

    return (
        <div class={styles.usersPanel}>
            <For each={activeUsers}>
                {(user) => USER_AVATAR(user.nombre, user.color)}
            </For>
        </div>
    )

};

const USER_AVATAR = (nombre: string, color: string) => {
    return (
        <div class={styles.userAvatar} style={{"background-color": color}}>{nombre.substring(0,2).toUpperCase()}</div>
    )
}


const TOP_BUTTONS = (onShare: () => void) => {
    return (
        <div class={styles.topButtons}>
            <img src={shareIco} alt="" onClick={onShare}/>
            <img src={downloadIco} alt="" onClick={(_) => exportDiagramAsPng(1)}/>
        </div>
    )
}

const PROJECT_NAME = () => {
    return (
        <div class={styles.projectName}>
            <p>Project Name: </p>
            <input placeholder='Enter project name...' type="text" value={userData.currentProjectName} onInput={(e) => updateCurrentProjectName(e.currentTarget.value)} onBlur={(_) => actionUpdateProjectName(userData.oldProjectName, userData.currentProjectName)}/>
        </div>
    )
}

export const EDITOR_HEADER = (handleShare: () => void) => {
    return (
        <div class={styles.header}>
            <span>
                { HEADER() }
                { PROJECT_NAME() }
            </span>

            <span>
                { USERS_PANEL() }
                { TOP_BUTTONS(handleShare) }
            </span>
        </div>
    )
}