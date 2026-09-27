"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import s from "./LanguageSelect.module.css";

const languages = { cs: "Čeština", en: "English", uk: "Українська" };
const locales = Object.keys(languages) as Locale[];
function Flag({ locale }: { locale: Locale }) {
  return (
    <svg
      width="24"
      height="16"
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
    >
      {locale === "cs" ? (
        <>
          <path fill="#fff" d="M0 0h30v10H0z" />
          <path fill="#d7141a" d="M0 10h30v10H0z" />
          <path fill="#11457e" d="m0 0 15 10L0 20z" />
        </>
      ) : locale === "uk" ? (
        <>
          <path fill="#0057b7" d="M0 0h30v10H0z" />
          <path fill="#ffd700" d="M0 10h30v10H0z" />
        </>
      ) : (
        <>
          <path fill="#012169" d="M0 0h30v20H0z" />
          <path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20" />
          <path stroke="#c8102e" strokeWidth="2" d="m0 0 30 20M30 0 0 20" />
          <path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" />
          <path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30" />
        </>
      )}
    </svg>
  );
}
export default function LanguageSelect({
  locale,
  change,
}: {
  locale: Locale;
  change: (locale: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>(`[lang="${locale}"]`)
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, locale]);
  return (
    <div
      ref={root}
      className={s.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          const buttons = [
            ...root.current!.querySelectorAll<HTMLButtonElement>(
              '[role="menuitemradio"]',
            ),
          ];
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 2
                : (index + (event.key === "ArrowUp" ? 2 : 1)) % 3
          ]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={s.trigger}
        aria-label={`Language: ${languages[locale]}`}
        title={languages[locale]}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <Flag locale={locale} />
      </button>
      {open && (
        <div id={id} role="menu" aria-label="Language" className={s.menu}>
          {locales.map((value) => (
            <button
              type="button"
              key={value}
              role="menuitemradio"
              lang={value}
              aria-label={languages[value]}
              title={languages[value]}
              aria-checked={value === locale}
              onClick={() => {
                change(value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <Flag locale={value} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
