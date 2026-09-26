import { copy, type Locale } from "@/lib/i18n";
import { AnalyticsSettingsButton } from "./AnalyticsConsent";
import InstallApp from "./InstallApp";
import s from "./Workspace.module.css";

export default function SiteFooter({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <footer className={s.footer}>
      <div className={s.footerCredits}>
        <span>
          {t.credits} ·{" "}
          <a
            href="https://github.com/tkdeeev/koswfriends"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.githubSource}
          </a>
        </span>
        <span>{t.independent}</span>
      </div>
      <div className={s.footerLinks}>
        <a href={`/privacy?lang=${locale}`}>{t.privacyNotice}</a>
        <a href={`/terms?lang=${locale}`}>{t.termsOfUse}</a>
        <AnalyticsSettingsButton locale={locale} />
        <InstallApp t={t} />
      </div>
    </footer>
  );
}
