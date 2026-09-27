"use client";
import { useRef, useState } from "react";
import type { Me } from "@/lib/types";
import type { Text } from "@/lib/i18n";
import Avatar from "./Avatar";
import s from "./Workspace.module.css";

export default function ProfilePicture({
  me,
  t,
  updated,
}: {
  me: Me;
  t: Text;
  updated: (version: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (file?: File) => {
    setError("");
    if (file && file.size > 5 * 1024 * 1024) {
      setError(t.pictureTooLarge);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/me/picture", {
        method: file ? "POST" : "DELETE",
        headers: {
          "X-CSRF-Token": me.csrf,
          ...(file
            ? { "Content-Type": file.type || "application/octet-stream" }
            : {}),
        },
        body: file,
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      updated(result.avatarVersion);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "picture_too_large"
          ? t.pictureTooLarge
          : code === "picture_invalid"
            ? t.pictureInvalid
            : t.error,
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <section
      className={s.pictureEditor}
      aria-label={t.profilePicture}
      aria-busy={busy}
    >
      <div className={s.picturePreview}>
        <Avatar person={me} />
      </div>
      <div>
        <h3>{t.profilePicture}</h3>
        <div className={s.actions}>
          <button
            className={`${s.button} ${s.secondary}`}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? t.loading : t.uploadPicture}
          </button>
          {me.avatarVersion && (
            <button
              className={s.quiet}
              disabled={busy}
              onClick={() => void save()}
            >
              {t.removePicture}
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-label={t.uploadPicture}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void save(file);
          }}
        />
        <p className={s.hint}>{t.pictureHint}</p>
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
