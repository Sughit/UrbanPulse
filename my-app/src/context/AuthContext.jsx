import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { user } = await api("/api/auth/me");
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function register(payload) {
    const { user } = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUser(user);
    return user;
  }

  async function login(payload) {
    const { user } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUser(user);
    return user;
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}