"use client";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { dailyCopy } from "@/lib/daily-copy";
import DetailModal from "./DetailModal";
import s from "./Daily.module.css";

export default function MealPhoto({
  meal,
  canteen,
  name,
  date,
  locale,
}: {
  meal: number;
  canteen: number;
  name: string;
  date: string;
  locale: Locale;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const url = `/api/menza/photo?meal=${meal}&canteen=${canteen}&lang=${locale}&day=${date}`;
  if (failed) return null;
  return (
    <>
      <button
        className={s.mealThumbnail}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${dailyCopy[locale].viewPhoto}: ${name}`}
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          width={88}
          height={72}
          onError={() => setFailed(true)}
        />
      </button>
      {open && (
        <DetailModal
          title={name}
          locale={locale}
          close={() => setOpen(false)}
          className={s.photoModal}
        >
          <img
            className={s.mealFullPhoto}
            src={url}
            alt={name}
            onError={() => setFailed(true)}
          />
        </DetailModal>
      )}
    </>
  );
}
