"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  ANALYTICS_CHOICE_KEY,
  ANALYTICS_CHOICE_VERSION,
  ANALYTICS_SETTINGS_EVENT,
  analyticsOptOut,
  readAnalyticsChoice,
  type AnalyticsChoice,
  type AnalyticsPage,
} from "@/lib/analytics";
import s from "./AnalyticsConsent.module.css";

const text = {
  cs: {
    title: "Volitelná analytika",
    settings: "Nastavení analytiky",
    description:
      "Povolit anonymní počítání návštěv částí aplikace pomocí vlastního Umami? Neposíláme rozvrh, jména, obsah formulářů ani identifikátory účtu. Volbu můžete kdykoli změnit v patičce.",
    accept: "Povolit",
    decline: "Odmítnout",
    privacy: "Ochrana osobních údajů",
    accepted: "Analytika je povolená.",
    declined: "Analytika je vypnutá.",
    blocked: "Váš prohlížeč požaduje nesledovat. Analytika je vypnutá.",
    unavailable: "Analytika není aktivní.",
    close: "Zavřít",
  },
  en: {
    title: "Optional analytics",
    settings: "Analytics settings",
    description:
      "Allow anonymous counts of visits to app sections using self-hosted Umami? We do not send timetables, names, form contents or account identifiers. You can change your choice in the footer at any time.",
    accept: "Allow",
    decline: "Decline",
    privacy: "Privacy notice",
    accepted: "Analytics are enabled.",
    declined: "Analytics are off.",
    blocked: "Your browser requests no tracking. Analytics are off.",
    unavailable: "Analytics are not active.",
    close: "Close",
  },
  uk: {
    title: "Необов’язкова аналітика",
    settings: "Налаштування аналітики",
    description:
      "Дозволити анонімний підрахунок відвідувань розділів застосунку через власний Umami? Ми не надсилаємо розклади, імена, вміст форм чи ідентифікатори облікових записів. Ви можете змінити вибір у нижній частині сторінки будь-коли.",
    accept: "Дозволити",
    decline: "Відхилити",
    privacy: "Конфіденційність",
    accepted: "Аналітику ввімкнено.",
    declined: "Аналітику вимкнено.",
    blocked: "Ваш браузер забороняє відстеження. Аналітику вимкнено.",
    unavailable: "Аналітика неактивна.",
    close: "Закрити",
  },
};

export function AnalyticsSettingsButton({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${s.settings} ${className || ""}`}
      onClick={() => window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT))}
    >
      {text[locale].settings}
    </button>
  );
}

export default function AnalyticsConsent({
  locale,
  page,
}: {
  locale: Locale;
  page: AnalyticsPage;
}) {
  const t = text[locale];
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  const lastPage = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [choice, setChoice] = useState<AnalyticsChoice | null>(null);

  useEffect(() => {
    const loadChoice = () => {
      setBlocked(analyticsOptOut(navigator));
      try {
        setChoice(
          readAnalyticsChoice(localStorage.getItem(ANALYTICS_CHOICE_KEY)),
        );
      } catch {
        setChoice(null);
      }
    };
    const open = () => {
      loadChoice();
      dialog.current?.showModal();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CHOICE_KEY || event.key === null)
        loadChoice();
    };
    loadChoice();
    const controller = new AbortController();
    fetch("/api/usage/config", {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => setEnabled(value?.enabled === true))
      .catch(() => {})
      .finally(() => setReady(true));
    window.addEventListener(ANALYTICS_SETTINGS_EVENT, open);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", loadChoice);
    return () => {
      controller.abort();
      pending.current?.abort();
      window.removeEventListener(ANALYTICS_SETTINGS_EVENT, open);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", loadChoice);
    };
  }, []);

  useEffect(() => {
    if (
      !ready ||
      !enabled ||
      blocked ||
      choice !== "accepted" ||
      analyticsOptOut(navigator)
    ) {
      pending.current?.abort();
      lastPage.current = null;
      return;
    }
    // A long-lived tab can outlast its stored consent without a focus or
    // storage event. Revalidate immediately before every navigation count.
    let currentChoice: AnalyticsChoice | null = null;
    try {
      currentChoice = readAnalyticsChoice(
        localStorage.getItem(ANALYTICS_CHOICE_KEY),
      );
    } catch {}
    if (currentChoice !== "accepted") {
      pending.current?.abort();
      lastPage.current = null;
      setChoice(currentChoice);
      return;
    }
    if (lastPage.current === page) return;
    lastPage.current = page;
    const controller = new AbortController();
    pending.current = controller;
    void fetch("/api/usage", {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        "X-Analytics-Consent": String(ANALYTICS_CHOICE_VERSION),
      },
      body: JSON.stringify({ page }),
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [ready, enabled, blocked, choice, page]);

  function choose(next: AnalyticsChoice) {
    pending.current?.abort();
    try {
      localStorage.setItem(
        ANALYTICS_CHOICE_KEY,
        JSON.stringify({
          version: ANALYTICS_CHOICE_VERSION,
          choice: next,
          savedAt: Date.now(),
        }),
      );
    } catch {}
    setChoice(next);
    dialog.current?.close();
  }
  const controls = (
    <div className={s.actions}>
      <button type="button" onClick={() => choose("declined")}>
        {t.decline}
      </button>
      <button
        type="button"
        disabled={!enabled || blocked}
        onClick={() => choose("accepted")}
      >
        {t.accept}
      </button>
    </div>
  );
  return (
    <>
      {ready && enabled && !blocked && choice === null && (
        <section className={s.banner} aria-label={t.title}>
          <h2>{t.title}</h2>
          <p>
            {t.description} <a href={`/privacy?lang=${locale}`}>{t.privacy}</a>
          </p>
          {controls}
        </section>
      )}
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby="analytics-title"
      >
        <h2 id="analytics-title">{t.title}</h2>
        <p>{t.description}</p>
        <p role="status">
          {blocked
            ? t.blocked
            : !enabled
              ? t.unavailable
              : choice === "accepted"
                ? t.accepted
                : t.declined}
        </p>
        <a href={`/privacy?lang=${locale}`}>{t.privacy}</a>
        {controls}
        <button
          type="button"
          className={s.close}
          onClick={() => dialog.current?.close()}
        >
          {t.close}
        </button>
      </dialog>
    </>
  );
}
