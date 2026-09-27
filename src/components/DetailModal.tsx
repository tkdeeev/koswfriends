"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { dailyCopy } from "@/lib/daily-copy";
import s from "./Daily.module.css";

/** Native modal focus trapping, Escape handling and return to the opener. */
export default function DetailModal({
  title,
  locale,
  close,
  children,
  className = "",
}: {
  title: string;
  locale: Locale;
  close: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${className}`}
      aria-labelledby={id}
      onClose={(event) => {
        event.stopPropagation();
        close();
      }}
      onCancel={(event) => event.stopPropagation()}
    >
      <div className={s.heading}>
        <h2 id={id}>{title}</h2>
        <button
          className={s.close}
          type="button"
          aria-label={dailyCopy[locale].close}
          onClick={() => ref.current?.close()}
          autoFocus
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
