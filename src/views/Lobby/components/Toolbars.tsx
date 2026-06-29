import { userData } from "../../../models/userStore";
import recent_ico from "../../../assets/recent.svg";
import logoutLogo from "../../../assets/logout.svg";
import myLogo from "../../../assets/NodusLogo.png";
import style from "../Lobby.module.css";
import { logout } from "../../../models/authStore";
import { useUser } from "../../../models/users";

// HEADER: solo el logo + título (sin contenedor extra)
export const HEADER = () => {
  return (
    <div class={style.brand}>
      <img src={myLogo} alt="Nodus" />
      <h1>Nodus Flow</h1>
    </div>
  );
};

// RECENT_USED: ahora es un elemento de navegación en el header
export const RECENT_USED = (onClick: () => void) => {
  return (
    userData.lastRoom && (
      <div class={style.recentLink} onClick={onClick}>
        <img src={recent_ico} alt="recent" />
        <span>Resume</span>
        <span class={style.roomId}>{userData.lastRoom}</span>
      </div>
    )
  );
};

// USERNAME: con logout integrado
export const USERNAME = () => {
  const user = useUser();
  return (
    <div class={style.userSection}>
      <span class={style.userName}>{user.name()}</span>
      <button class={style.logoutBtn} onClick={logout}>
        <img src={logoutLogo} alt="logout" />
      </button>
    </div>
  );
};

// CREATE_FLOW: con pequeñas mejoras de maquetación
export const CREATE_FLOW = (onCreate: () => void, onJoin: () => void) => {
  return (
    <div class={style.createFlow}>
      <div class={style.subtitle}>Start a session</div>
      <button onClick={onCreate} id={style.newFlow}>New Flow</button>
      <div class={style.divider} />
      <span class={style.labelInfo}>or join existing</span>
      <label class={style.inputLabel}>Room ID</label>
      <input
        type="text"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        id={style.roomIdInput}
        maxLength="10"
        minLength="10"
      />
      <button onClick={onJoin} id={style.join}>Join by ID</button>
    </div>
  );
};

// COPYRIGHT: simple
export const COPYRIGHT = () => {
  return <p class={style.copyright}>© 2026 Bello's Projects</p>;
};

// DEVICE_INFO: opcional
export const DEVICE_INFO = (props: { deviceId: string; daysLeft: number; expiryDate: Date }) => {
  return (
    <div class={style.deviceInfo}>
      <p>Device: {props.deviceId}</p>
      <p>Days: {props.daysLeft}</p>
      <p>Expires: {props.expiryDate.toLocaleDateString('es-ES')}</p>
    </div>
  );
};