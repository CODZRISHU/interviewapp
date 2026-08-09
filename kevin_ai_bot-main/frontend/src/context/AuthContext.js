import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

import { api } from "../services/api";
import { clearTokens, getRefreshToken, setTokens } from "../services/tokenStorage";

const AuthContext = createContext(null);

export const triggerGlobalUserRefresh = () => {
  window.dispatchEvent(new CustomEvent("kevin-auth:refresh-user"));
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const userResponse = await api.get("/auth/me");
      setUser(userResponse.data);
      return userResponse.data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getRefreshToken()) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearTokens();
      setUser(null);
      setLoading(false);
    };

    const handleRefreshUser = () => {
      checkAuth();
    };

    window.addEventListener("kevin-auth:unauthorized", handleUnauthorized);
    window.addEventListener("kevin-auth:refresh-user", handleRefreshUser);
    return () => {
      window.removeEventListener("kevin-auth:unauthorized", handleUnauthorized);
      window.removeEventListener("kevin-auth:refresh-user", handleRefreshUser);
    };
  }, [checkAuth]);

  const login = (payload) => {
    if (payload?.tokens) {
      setTokens(payload.tokens);
    }
    if (payload?.user) {
      setUser(payload.user);
    }
    setLoading(false);
  };

  const logout = async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      }
    } catch { /* ignore */ }
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, refreshUser: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
