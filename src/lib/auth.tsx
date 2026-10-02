import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const TOKEN_KEY = "quickchat.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type Me = {
  id: number;
  phone: string;
  name: string;
  about: string;
  avatarUrl: string | null;
  profileComplete: boolean;
  privacy: { lastSeen: string; avatar: string; about: string; readReceipts: boolean };
  notifySettings: { messages: boolean; groups: boolean; calls: boolean; sounds: boolean };
};

type ThemeMode = "light" | "dark" | "system";

type AuthCtx = {
  token: string | null;
  setAuth: (token: string) => void;
  logout: () => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};

const Ctx = createContext<AuthCtx>({
  token: null,
  setAuth: () => {},
  logout: () => {},
  theme: "system",
  setTheme: () => {},
});

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(getToken());
  const [theme, setThemeState] = useState<ThemeMode>(
    () => (localStorage.getItem("quickchat.theme") as ThemeMode) || "system",
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("quickchat.theme", theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return (
    <Ctx.Provider
      value={{
        token,
        setAuth: (t) => {
          setToken(t);
          setTok(t);
        },
        logout: () => {
          setToken(null);
          setTok(null);
        },
        theme,
        setTheme: setThemeState,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
