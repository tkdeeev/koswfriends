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
        <figcaption className={s.caption}>
          <span>{t.landingExample}</span>
          <span className={s.sample}>{t.preview}</span>
        </figcaption>
        <div role="img" aria-label={t.landingExampleAlt}>
          <div className={s.schedule} aria-hidden="true">
            <span className={s.day}>{t.monday}</span>
            {["09:00", "10:30", "12:00", "13:30"].map((time) => (
              <span className={s.time} key={time}>
                {time}
              </span>
            ))}
            <span className={`${s.person} ${s.you}`}>{t.you}</span>
            <span className={`${s.person} ${s.alex}`}>Alex</span>
            <span className={`${s.person} ${s.sam}`}>Sam</span>
            <span className={`${s.lesson} ${s.math}`}>MAT</span>
            <span className={`${s.lesson} ${s.code}`}>PRG</span>
            <span className={`${s.lesson} ${s.physics}`}>FYZ</span>
            <span className={`${s.lesson} ${s.lab}`}>LAB</span>
            <div className={s.shared}>
              <span className={s.plus} aria-hidden="true">
                ++
              </span>
              <strong>{t.landingLunch}</strong>
              <span>12:00–13:30</span>
            </div>
          </div>
        </div>
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
