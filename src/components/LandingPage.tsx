import { copy, type Locale } from "@/lib/i18n";
import s from "./LandingPage.module.css";

export default function LandingPage({
  locale,
  signIn,
}: {
  locale: Locale;
  signIn: string;
}) {
  const t = copy[locale];

  return (
    <main className={s.landing}>
      <section className={s.introduction} aria-labelledby="landing-title">
        <div>
          <p className={s.eyebrow}>
            KOS with Friends <span aria-hidden="true">++</span>
          </p>
          <h1 id="landing-title">
            {t.hero}{" "}
            <span>{t.heroAccent}</span>
          </h1>
        </div>
        <div>
          <p className={s.intro}>{t.intro}</p>
          <a className={s.signIn} href={signIn}>
            {t.signIn} <span aria-hidden="true">↗</span>
          </a>
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
