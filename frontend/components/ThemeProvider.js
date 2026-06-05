"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

const STORAGE_KEY = "saqi:theme";

/**
 * ThemeBootstrap — inline script that runs *before* React hydrates.
 * Picks the saved theme (or system) and applies it to <html> so the
 * first paint is correct. Prevents the flash of wrong theme on reload.
 */
export function ThemeBootstrap() {
  const code = `
    (function(){
      try {
        var k = ${JSON.stringify(STORAGE_KEY)};
        var saved = localStorage.getItem(k);
        var mql = window.matchMedia('(prefers-color-scheme: dark)');
        var resolved = saved === 'dark' || saved === 'light'
          ? saved
          : (mql.matches ? 'dark' : 'light');
        var root = document.documentElement;
        root.setAttribute('data-theme', resolved);
        root.dataset.themePreference = saved || 'system';
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("system");
  const [resolved, setResolved] = useState("light");

  // Hydrate from <html> attributes that the bootstrap script set
  useEffect(() => {
    const root = document.documentElement;
    const pref = root.dataset.themePreference || "system";
    const current = root.getAttribute("data-theme") || "light";
    setThemeState(pref);
    setResolved(current);
  }, []);

  // React to OS-level changes when on system preference
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      const next = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      setResolved(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    const root = document.documentElement;
    const effective =
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next;
    root.setAttribute("data-theme", effective);
    root.dataset.themePreference = next;
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setThemeState(next);
    setResolved(effective);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
