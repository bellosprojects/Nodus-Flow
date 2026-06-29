import { createSignal, Show } from "solid-js";
import { login } from "../../models/authStore";
import styles from "./Auth.module.css";

export const Login = (props: { 
    onSuccess: () => void, 
    onSwitchToSignup: () => void,
    onResendConfirmation?: (email: string) => void 
}) => {
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [needsConfirmation, setNeedsConfirmation] = createSignal(false);

    const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setNeedsConfirmation(false);
        
        const result = await login(email(), password());
        setLoading(false);
        
        if (result.success) {
            props.onSuccess();
        } else {
            if (result.error?.toLowerCase().includes("confirm your email")) {
                setNeedsConfirmation(true);
            }
            setError(result.error || "Login failed");
        }
    };

    const handleResendConfirmation = async () => {
        if (props.onResendConfirmation) {
            await props.onResendConfirmation(email());
        }
    };

    return (
        <div class={styles.authContainer}>
            <div class={styles.authCard}>
                <h2 class={styles.authTitle}>Welcome Back</h2>
                
                <Show when={error()}>
                    <div class={styles.errorMessage}>
                        {error()}
                        <Show when={needsConfirmation()}>
                            <button 
                                class={styles.resendButton}
                                onClick={handleResendConfirmation}
                            >
                                Resend confirmation
                            </button>
                        </Show>
                    </div>
                </Show>
                
                <form onSubmit={handleSubmit}>
                    <div class={styles.inputGroup}>
                        <label>Email</label>
                        <input 
                            class={styles.authInput} 
                            type="email"
                            placeholder="name@domain.com" 
                            value={email()} 
                            onInput={e => setEmail(e.currentTarget.value)} 
                            required 
                            disabled={loading()}
                        />
                    </div>
                    <div class={styles.inputGroup}>
                        <label>Password</label>
                        <input 
                            class={styles.authInput} 
                            type="password" 
                            placeholder="••••••••" 
                            value={password()} 
                            onInput={e => setPassword(e.currentTarget.value)} 
                            required 
                            disabled={loading()}
                        />
                    </div>
                    
                    <button 
                        class={styles.authButton} 
                        type="submit" 
                        disabled={loading()}
                    >
                        {loading() ? (
                            <>
                                <span class={styles.loadingSpinner}></span>
                                Signing in...
                            </>
                        ) : (
                            "Sign in"
                        )}
                    </button>
                    
                    <button 
                        class={`${styles.authButton} ${styles.authButtonSecondary}`} 
                        type="button" 
                        onClick={props.onSwitchToSignup}
                        disabled={loading()}
                    >
                        Create an account
                    </button>
                </form>

                <div class={styles.appFooter}>
                    <span>Nodus Flow v{appVersion}</span>
                    <span class={styles.company}> · Bello's Projects</span>
                </div>
            </div>
        </div>
    );
};