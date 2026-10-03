"use client";
import { copy, type Locale } from "@/lib/i18n";
import s from "./LandingPage.module.css";
import { useState } from "react";
import { externalCopy } from "@/lib/external-copy";

export default function LandingPage({
  locale,
  signIn,
}: {
  locale: Locale;
  signIn: string;
}) {
  const t = copy[locale];
  const c = externalCopy[locale];
  const [other, setOther] = useState(false);
  const providerLink = (provider: string) =>
    `${signIn}${signIn.includes("?") ? "&" : "?"}provider=${provider}`;

  return (
    <main className={s.landing}>
      <section className={s.introduction} aria-labelledby="landing-title">
        <div>
          <p className={s.eyebrow}>
            KOS with Friends <span aria-hidden="true">++</span>
          </p>
          <h1 id="landing-title">
            {t.hero} <span>{t.heroAccent}</span>
          </h1>
        </div>
        <div>
          <p className={s.intro}>{t.intro}</p>
          <div className={s.loginActions}>
            <a className={s.signIn} href={signIn}>
              {t.signIn} <span aria-hidden="true">↗</span>
            </a>
            <button
              className={`${s.signIn} ${s.otherSignIn}`}
              aria-expanded={other}
              aria-controls="other-login"
              onClick={() => setOther(!other)}
            >
              {c.signIn}
            </button>
          </div>
          {other && (
            <div id="other-login" className={s.otherLogin}>
              <p>{c.hint}</p>
              <div className={s.providerActions}>
                <a className={s.provider} href={providerLink("google")}>
                  Google
                </a>
                <a className={s.provider} href={providerLink("discord")}>
                  Discord
                </a>
              </div>
            </div>
          )}
          <p className={s.legal}>
            {t.signInLegal} <a href={`/terms?lang=${locale}`}>{t.termsOfUse}</a>{" "}
            · <a href={`/privacy?lang=${locale}`}>{t.privacyNotice}</a>
          </p>
        </div>
      </section>

      <figure className={s.example}>
        <img
          className={s.previewLight}
          src={`/preview/timetable-${locale}-light.png`}
          alt={t.previewAlt}
          width={1280}
          height={940}
        />
        <img
          className={s.previewDark}
          src={`/preview/timetable-${locale}-dark.png`}
          alt={t.previewAlt}
          width={1280}
          height={940}
        />
        <figcaption className={s.caption}>{t.preview}</figcaption>
      </figure>

      <ul className={s.benefits}>
        {[
          [t.landingTimetable, t.landingTimetableBody],
          [t.landingFriends, t.landingFriendsBody],
          [t.landingPlans, t.landingPlansBody],
        ].map(([title, body]) => (
          <li key={title}>
            <span className={s.benefitPlus} aria-hidden="true">
              +
            </span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
