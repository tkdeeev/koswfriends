"use client";
import { useEffect, useRef, useState } from "react";
import type { Text } from "@/lib/i18n";
import s from "./Workspace.module.css";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp({ t }: { t: Text }) {
  const [installed, setInstalled] = useState(true);
  const [apple, setApple] = useState(false);
  const prompt = useRef<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = matchMedia("(display-mode: standalone)");
    const sync = () =>
      setInstalled(
        media.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    sync();
    setApple(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const capture = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
    };
    const complete = () => {
      prompt.current = null;
      setInstalled(true);
      dialog.current?.close();
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    media.addEventListener("change", sync);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      media.removeEventListener("change", sync);
    };
  }, []);

  return (
    <>
      {!installed && (
        <button
          className={s.quiet}
          onClick={async () => {
            const available = prompt.current;
            prompt.current = null;
            if (available) {
              try {
                await available.prompt();
                await available.userChoice;
                return;
              } catch {}
            }
            dialog.current?.showModal();
          }}
        >
          {t.installApp}
        </button>
      )}
      <dialog
        ref={dialog}
        className={s.installDialog}
        aria-labelledby="install-title"
      >
        <div className={s.dialogTitle}>
          <h2 id="install-title">{t.installApp}</h2>
          <button
            className={s.iconButton}
            aria-label={t.close}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p>{apple ? t.installApple : t.installBrowser}</p>
      </dialog>
    </>
  );
}
