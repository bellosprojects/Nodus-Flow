import { createSignal, Show } from "solid-js";
import { signup } from "../../models/authStore";
import styles from "./Auth.module.css";

export const Signup = (props: { 
    onSuccess: () => void, 
    onSwitchToLogin: () => void 
}) => {
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [confirmPassword, setConfirmPassword] = createSignal("");
    const [displayName, setDisplayName] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [success, setSuccess] = createSignal(false);

    const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

    const validate = () => {
        if (password().length < 6) {
            setError("Password must be at least 6 characters");
            return false;
        }
        if (password() !== confirmPassword()) {
            setError("Passwords do not match");
            return false;
        }
        if (displayName().trim().length < 2) {
            setError("Display name must be at least 2 characters");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError(null);
        
        if (!validate()) return;
        
        setLoading(true);
        const result = await signup(email(), password(), displayName().trim());
        setLoading(false);
        
        if (result.success) {
            setSuccess(true);
            setTimeout(() => {
                props.onSuccess();
            }, 3000);
        } else {
            setError(result.error || "Registration failed");
        }
    };

    const CheckIcon = () => (
        <svg class={styles.checkIcon} viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );

    return (
        <div class={styles.authContainer}>
            <div class={styles.authCard}>
                <h2 class={styles.authTitle}>Create Account</h2>
                
                <Show when={success()}>
                    <div class={styles.successMessage}>
                        <CheckIcon />
                        Account created successfully!
                        <span class={styles.successSubtext}>
                            Please check your email to confirm your account.
                            <br />
                            You will be redirected to login...
                        </span>
                    </div>
                </Show>
                
                <Show when={error() && !success()}>
                    <div class={styles.errorMessage}>{error()}</div>
                </Show>
                
                <Show when={!success()}>
                    <form onSubmit={handleSubmit}>
                        <div class={styles.inputGroup}>
                            <label>Display Name</label>
                            <input 
                                class={styles.authInput} 
                                type="text"
                                placeholder="Your name" 
                                value={displayName()} 
                                onInput={e => setDisplayName(e.currentTarget.value)} 
                                required 
                                disabled={loading()}
                            />
                        </div>
                        
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
                            <label>Password (min 6)</label>
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
                        
                        <div class={styles.inputGroup}>
                            <label>Confirm Password</label>
                            <input 
                                class={styles.authInput} 
                                type="password" 
                                placeholder="••••••••" 
                                value={confirmPassword()} 
                                onInput={e => setConfirmPassword(e.currentTarget.value)} 
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
                                    Creating...
                                </>
                            ) : (
                                "Create Account"
                            )}
                        </button>
                        
                        <button 
                            class={`${styles.authButton} ${styles.authButtonSecondary}`} 
                            type="button" 
                            onClick={props.onSwitchToLogin}
                            disabled={loading()}
                        >
                            Already have an account? Login
                        </button>
                    </form>
                </Show>

                <div class={styles.appFooter}>
                    <span>Nodus Flow v{appVersion}</span>
                    <span class={styles.company}> · Bello's Projects</span>
                </div>
            </div>
        </div>
    );
};