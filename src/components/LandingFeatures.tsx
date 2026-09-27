import type { Text } from "@/lib/i18n";
import Icon from "./Icon";
import s from "./LandingFeatures.module.css";

export default function LandingFeatures({ t }: { t: Text }) {
  return (
    <div className={s.features}>
      <section>
        <div className={s.heading}>
          <Icon name="users" />
          <h2>{t.landingTogether}</h2>
        </div>
        <p>{t.landingTogetherBody}</p>
        <ul>
          <li>{t.landingSharedLessons}</li>
          <li>{t.landingInvites}</li>
          <li>{t.landingSharing}</li>
        </ul>
      </section>
      <section>
        <div className={s.heading}>
          <Icon name="calendar" />
          <h2>{t.landingEveryday}</h2>
        </div>
        <p>{t.landingEverydayBody}</p>
        <ul>
          <li>{t.landingPersonal}</li>
          <li>{t.landingMobile}</li>
          <li>{t.landingPreferences}</li>
        </ul>
      </section>
    </div>
  );
}
