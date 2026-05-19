import { For } from "solid-js";
import styles from  "./Toast.module.css";
import { handleToastAction, toasts, ToastType } from "../../models/toast";

export const ToastContainer = () => {
    return (
        <div class={styles.container}>
            <For each={toasts}>
                {toast => 
                    <div class={`${styles.toast} ${styles[toast.type]}`}>
                        {toast.type === ToastType.PROCESSING && (
                            <div class={styles.spinner}></div>
                        )}
                        <span>{toast.message}</span>
                        {toast.onClick !== undefined && (<span class={styles.toastAction} onClick={() => handleToastAction(toast)}>
                            {toast.onClick.label}
                        </span>)}
                    </div>
                }
            </For>
        </div>
    );
}