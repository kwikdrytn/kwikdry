import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  role: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_STORAGE_KEY = "mock_users";
const SESSION_STORAGE_KEY = "mock_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const sessionUser = JSON.parse(savedSession);
        setUser(sessionUser);
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const getUsers = useCallback((): Record<string, { user: User; password: string }> => {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }, []);

  const saveUsers = useCallback((users: Record<string, { user: User; password: string }>) => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    const users = getUsers();
    const userRecord = users[email.toLowerCase()];

    if (!userRecord) {
      return { error: "No account found with this email" };
    }

    if (userRecord.password !== password) {
      return { error: "Invalid password" };
    }

    setUser(userRecord.user);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userRecord.user));
    return {};
  }, [getUsers]);

  const signUp = useCallback(async (email: string, password: string, fullName: string): Promise<{ error?: string }> => {
    const users = getUsers();
    const emailLower = email.toLowerCase();

    if (users[emailLower]) {
      return { error: "An account with this email already exists" };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: emailLower,
      full_name: fullName,
      role: "user",
      created_at: new Date().toISOString(),
    };

    users[emailLower] = { user: newUser, password };
    saveUsers(users);

    setUser(newUser);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));
    return {};
  }, [getUsers, saveUsers]);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
