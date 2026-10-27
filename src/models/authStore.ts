import { createStore } from "solid-js/store";
import { showToast, ToastType } from "./toast";
import { wsService } from "../core/socket";

export const API_URL = "https://render-yqtz.onrender.com";

interface AuthState {
    user: {
        id: string | null;
        email: string | null;
        nickname: string | null;
        display_name: string | null;
    } | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}

const [authStore, setAuthStore] = createStore<AuthState>({
    user: null,
    token: localStorage.getItem("auth_token"),
    isAuthenticated: !!localStorage.getItem("auth_token"),
    loading: false,
    error: null
});

// Cargar perfil si hay token
if (authStore.token) {
    fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authStore.token}` }
    })
    .then(res => {
        if(!res.ok) throw new Error("Session expired");
        return res.json();
    })
    .then(data => {

        setAuthStore("user", data);
        setAuthStore("isAuthenticated", true);
        setAuthStore("error", null);

    }).catch(() => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        setAuthStore("token", null);
        setAuthStore("isAuthenticated", false);
        setAuthStore("error", "Session expired. Please login again");
    });
}

export const login = async (email: string, password: string) => {

    setAuthStore("loading", true);
    setAuthStore("error", null);

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {

            if(data.detail?.includes("Email not confirmed")){
                throw new Error("Please confirm your email address. Check your inbox!");
            }
            throw new Error(data.detail || "Invalid credentials");
        }

        localStorage.setItem("auth_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);

        setAuthStore("token", data.access_token);
        setAuthStore("user", {
            id: data.id,
            email,
            nickname: data.nickname || data.display_name,
            display_name: data.display_name || data.nickname
        });
        setAuthStore("isAuthenticated", true);
        setAuthStore("loading", false);
        setAuthStore("error", null);

        showToast(`Welcome ${data.display_name}!`, ToastType.SUCCES);
        return { success: true, data};
    } catch (err: any) {
        const errorMessage = err.message || "Login failed. Please try again.";
        setAuthStore("error", errorMessage);
        setAuthStore("loading", false);
        showToast(errorMessage, ToastType.ERROR);
        return { success: false, error: errorMessage };
    }
};

export const signup = async (email: string, password: string, nickname: string) => {
    
    setAuthStore("loading", true);
    setAuthStore("error", null);
    
    try {
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, password: password, nickname: nickname }) 
        });

        const data = await res.json();

        if (!res.ok) {
            if (data.detail?.includes("already registered")) {
                throw new Error("This email is already registered. Please login instead.");
            }
            throw new Error(data.detail || "Registration failed");
        }
        
        setAuthStore("loading", false);
        setAuthStore("error", null);
        
        showToast(
            "Account created! Please check your email to confirm your account.",
            ToastType.SUCCES
        );
        return { success: true };
        
    } catch (err: any) {
        const errorMessage = err.message || "Registration failed. Please try again.";
        setAuthStore("error", errorMessage);
        setAuthStore("loading", false);
        showToast(errorMessage, ToastType.ERROR);
        return { success: false, error: errorMessage };
    }
};

export const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    setAuthStore("token", null);
    setAuthStore("user", null);
    setAuthStore("isAuthenticated", false);
    setAuthStore("error", null);

    showToast("Logged out", ToastType.INFO);
    
    wsService.closeSocket();
};

// Añade esto a authStore.ts
export const refreshSession = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;
    
    try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (!res.ok) throw new Error("Refresh failed");
        
        const data = await res.json();
        localStorage.setItem("auth_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        setAuthStore("token", data.access_token);
        return true;
        
    } catch {
        logout();
        return false;
    }
};

export { authStore };