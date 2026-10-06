import { useEffect, useState, type ReactNode } from "react";
import { Ctx, getToken, setToken, TOKEN_KEY, type ThemeMode } from "./auth";

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
    const changed = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY) {
        window.dispatchEvent(new Event('quickchat-account-change'));
        setTok(event.newValue);
      }
    };
    window.addEventListener('storage',changed);
    return () => window.removeEventListener('storage',changed);
  }, []);

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
