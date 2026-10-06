import { createContext, useContext } from "react";

export const TOKEN_KEY = "quickchat.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  window.dispatchEvent(new Event('quickchat-account-change'));
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type Me = {
  id: number;
  phone: string | null;
  email?: string | null;
  username?: string | null;
  name: string;
  about: string;
  avatarUrl: string | null;
  profileComplete: boolean;
  privacy: { lastSeen: "everyone" | "contacts" | "nobody"; avatar: "everyone" | "contacts" | "nobody"; about: "everyone" | "contacts" | "nobody"; readReceipts: boolean };
  notifySettings: { messages: boolean; groups: boolean; calls: boolean; sounds: boolean };
};

export type ThemeMode = "light" | "dark" | "system";

type AuthCtx = {
  token: string | null;
  setAuth: (token: string) => void;
  logout: () => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};

export const Ctx = createContext<AuthCtx>({
  token: null,
  setAuth: () => {},
  logout: () => {},
  theme: "system",
  setTheme: () => {},
});


export function useAuth() {
  return useContext(Ctx);
}
