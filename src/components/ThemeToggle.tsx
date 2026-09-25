"use client";
import { useEffect, useState } from "react";
import type { Text } from "@/lib/i18n";
import s from "./Workspace.module.css";
import Icon from "./Icon";
function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) =>
      meta.setAttribute("content", dark ? "#141f29" : "#ffffff"),
    );
}
export default function ThemeToggle({ t }: { t: Text }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("kwf_theme");
      } catch {}
      const next = saved === "dark" || (saved !== "light" && media.matches);
      applyTheme(next);
      setDark(next);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return (
    <button
      className={`${s.quiet} ${s.themeToggle}`}
      aria-label={t.darkMode}
      title={t.darkMode}
      aria-pressed={dark}
      onClick={() => {
        const next = !dark;
        applyTheme(next);
        setDark(next);
        try {
          localStorage.setItem("kwf_theme", next ? "dark" : "light");
        } catch {}
      }}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}
