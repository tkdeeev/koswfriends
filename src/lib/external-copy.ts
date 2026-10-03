export const externalCopy = {
  cs: {
    signIn: "Přihlásit se jinak",
    hint: "I bez účtu ČVUT. Kalendář můžete přidat později, nebo vůbec.",
    external: "Externí účet",
    feeds: "Kalendáře ICS",
    feedHint:
      "Přidejte soukromý HTTPS odkaz na ICS kalendář z jakékoli školy či služby. Události se sdílí podle oprávnění vašeho rozvrhu. Odkaz zůstává soukromý.",
    name: "Název kalendáře",
    url: "Odkaz na ICS kalendář",
    add: "Přidat kalendář",
    remove: "Odebrat kalendář",
    removeConfirm: "Odebrat tento kalendář a jeho importované události?",
    empty: "Zatím žádný další kalendář. Import je volitelný.",
    importing: "Načítání kalendáře…",
    limits:
      "Nejvýše 5 kalendářů, 1 MB na zdroj a 2 000 výskytů za semestr a 100 za den. Automatická aktualizace každých 15 minut u aktivních účtů.",
    pending: "Čeká na načtení pro tento semestr",
    synced: "Poslední načtení",
    errors: {
      login_unconfigured:
        "Tento způsob přihlášení zatím není nastavený provozovatelem.",
      identity_conflict:
        "Toto uživatelské jméno již patří jinému účtu. Kontaktujte podporu.",
      ics_url:
        "Použijte veřejně dostupný HTTPS nebo webcal odkaz bez přihlašovacích údajů. Interní adresy nejsou povolené.",
      ics_invalid: "Zdroj neobsahuje platný podporovaný ICS kalendář.",
      ics_limit:
        "Kalendář je příliš velký nebo má příliš složité opakování. Zvolte menší zdroj; hodinové a kratší opakování není podporováno.",
      ics_unavailable:
        "Kalendář se nepodařilo stáhnout. Poslední úspěšná data zůstávají zachovaná.",
      ics_full: "Můžete přidat nejvýše 5 kalendářů.",
      ics_duplicate: "Tento kalendář už máte přidaný.",
      ics_pending: "Kalendář pro tento semestr ještě nebyl načten.",
      sync_cooldown: "Před dalším načtením počkejte jednu minutu.",
    },
  },
  en: {
    signIn: "Sign in another way",
    hint: "No CTU account needed. Add a calendar later, or use the app without one.",
    external: "External account",
    feeds: "ICS calendars",
    feedHint:
      "Add a private HTTPS subscription link from any university or calendar service. Events follow your timetable sharing permissions. The link stays private.",
    name: "Calendar name",
    url: "ICS calendar URL",
    add: "Add calendar",
    remove: "Remove calendar",
    removeConfirm: "Remove this calendar and its imported events?",
    empty: "No additional calendars yet. Importing is optional.",
    importing: "Importing calendar…",
    limits:
      "Up to 5 calendars, 1 MB per source and 2,000 occurrences per semester and 100 per day. Active accounts refresh automatically every 15 minutes.",
    pending: "Awaiting import for this semester",
    synced: "Last import",
    errors: {
      login_unconfigured:
        "The operator has not configured this sign-in option yet.",
      identity_conflict:
        "This username belongs to another account. Please contact support.",
      ics_url:
        "Use a publicly reachable HTTPS or webcal URL without login credentials. Internal addresses are blocked.",
      ics_invalid: "The source is not a valid supported ICS calendar.",
      ics_limit:
        "The calendar is too large or its recurrence is too complex. Choose a smaller feed; hourly and shorter recurrence is unsupported.",
      ics_unavailable:
        "Could not download the calendar. The last successful import is preserved.",
      ics_full: "You can add up to 5 calendars.",
      ics_duplicate: "This calendar is already added.",
      ics_pending: "This calendar has not been imported for this semester yet.",
      sync_cooldown: "Wait one minute before importing again.",
    },
  },
  uk: {
    signIn: "Увійти іншим способом",
    hint: "Обліковий запис ČVUT не потрібен. Календар можна додати пізніше або не додавати.",
    external: "Зовнішній обліковий запис",
    feeds: "Календарі ICS",
    feedHint:
      "Додайте приватне HTTPS-посилання на календар будь-якого університету чи сервісу. Події використовують налаштування доступу до вашого розкладу. Посилання залишається приватним.",
    name: "Назва календаря",
    url: "Посилання на ICS-календар",
    add: "Додати календар",
    remove: "Видалити календар",
    removeConfirm: "Видалити цей календар та імпортовані події?",
    empty: "Додаткових календарів поки немає. Імпорт необов’язковий.",
    importing: "Імпорт календаря…",
    limits:
      "До 5 календарів, 1 МБ на джерело та 2 000 повторень за семестр та 100 на день. Автоматичне оновлення активних облікових записів кожні 15 хвилин.",
    pending: "Очікує імпорту для цього семестру",
    synced: "Останній імпорт",
    errors: {
      login_unconfigured: "Оператор ще не налаштував цей спосіб входу.",
      identity_conflict:
        "Це ім’я користувача належить іншому обліковому запису. Зверніться до підтримки.",
      ics_url:
        "Використовуйте загальнодоступне HTTPS- або webcal-посилання без облікових даних. Внутрішні адреси заблоковано.",
      ics_invalid:
        "Джерело не містить підтримуваного коректного ICS-календаря.",
      ics_limit:
        "Календар завеликий або повторення надто складне. Оберіть менше джерело; погодинні та частіші повторення не підтримуються.",
      ics_unavailable:
        "Не вдалося завантажити календар. Останній успішний імпорт збережено.",
      ics_full: "Можна додати до 5 календарів.",
      ics_duplicate: "Цей календар уже додано.",
      ics_pending: "Календар ще не імпортовано для цього семестру.",
      sync_cooldown: "Зачекайте хвилину перед повторним імпортом.",
    },
  },
};
