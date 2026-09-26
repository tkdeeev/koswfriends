"use client";
import { useEffect, useState } from "react";
import { copy, preferredLocale, type Locale } from "@/lib/i18n";
import { legalCopy, LEGAL_VERSION, PRIVACY_EMAIL } from "@/lib/legal-copy";
import AnalyticsConsent from "./AnalyticsConsent";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import SiteFooter from "./SiteFooter";
import s from "./LegalPage.module.css";

export default function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const [locale, setLocale] = useState<Locale>("cs");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("kwf_locale");
    } catch {}
    const query = new URLSearchParams(location.search).get("lang");
    setLocale(preferredLocale(query || saved, navigator.language));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const text = legalCopy[locale];
  const legalDocument = text[kind];
  const changeLocale = (value: Locale) => {
    setLocale(value);
    try {
      localStorage.setItem("kwf_locale", value);
    } catch {}
    history.replaceState(null, "", `/${kind}?lang=${value}`);
  };
  return (
    <div className={s.page}>
      <header className={s.header}>
        <a href="/" aria-label="KOSwFriends">
          <Logo />
        </a>
        <div className={s.controls}>
          <ThemeToggle t={copy[locale]} />
          {(["cs", "en", "uk"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={locale === value}
              onClick={() => changeLocale(value)}
            >
              {value === "cs" ? "CZ" : value === "uk" ? "UA" : "EN"}
            </button>
          ))}
        </div>
      </header>
      <main className={s.content}>
        <a href="/">← {text.back}</a>
        <h1>{legalDocument.title}</h1>
        <p className={s.date}>
          {text.updated}: {LEGAL_VERSION}
        </p>
        <p>{legalDocument.intro}</p>
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
        {legalDocument.sections.map((section, i) => (
          <section key={section.title} aria-labelledby={`section-${i}`}>
            <h2 id={`section-${i}`}>{section.title}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.links && (
              <div className={s.links}>
                {section.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
      <SiteFooter locale={locale} />
      <AnalyticsConsent locale={locale} page={kind} />
    </div>
  );
}
