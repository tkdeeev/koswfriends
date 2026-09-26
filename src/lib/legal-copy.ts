import type { Locale } from "./i18n";

export const LEGAL_VERSION = "2026-09-26";
export const OPERATOR = "Tomáš Viktor Kubíček";
export const PRIVACY_EMAIL = "tkdeeev@gmail.com";
export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  links?: { label: string; href: string }[];
};
type Document = { title: string; intro: string; sections: LegalSection[] };
const providers = [
  {
    label: "Hetzner",
    href: "https://docs.hetzner.com/general/company-and-policy/data-protection-at-hetzner/",
  },
  {
    label: "Cloudflare DPA",
    href: "https://www.cloudflare.com/cloudflare-customer-dpa/",
  },
  { label: "Google / Gmail", href: "https://policies.google.com/privacy" },
];
const authority = [
  {
    label: "Úřad pro ochranu osobních údajů (ÚOOÚ)",
    href: "https://uoou.gov.cz/",
  },
];
export const legalCopy: Record<
  Locale,
  { updated: string; back: string; privacy: Document; terms: Document }
> = {
  cs: {
    updated: "Platné od",
    back: "Zpět do aplikace",
    privacy: {
      title: "Ochrana osobních údajů",
      intro:
        "KOSwFriends provozuje Tomáš Viktor Kubíček (TKDEV), fyzická osoba, která je správcem osobních údajů. Kontakt pro soukromí a uplatnění práv: tkdeeev@gmail.com. Jde o nezávislý studentský projekt, nikoli službu provozovanou ČVUT.",
      sections: [
        {
          title: "Jaké údaje zpracováváme",
          items: [
            "Po školním přihlášení: uživatelské jméno, jméno poskytnuté školou, interní identifikátor, zvolený semestr a čas vytvoření a poslední aktivity účtu. Zdrojem školních údajů jsou OAuth a Sirius ČVUT.",
            "Váš rozvrh: předměty, názvy a identifikátory hodin, typ výuky, skupina, čas, místnost a zrušení hodiny. Uchováváme poslední úspěšně načtenou podobu rozvrhu pro zvolené semestry.",
            "Vámi zadané události, opakování, barvy a poznámky; případné návrhy semestru; žádosti o přátelství, skupiny, členství, pozvánky, blokace a nastavení sdílení.",
            "Šifrované přístupové a obnovovací tokeny školy, přihlašovací relace a údaje potřebné pro zabezpečení. Heslo ke škole aplikace nepřijímá ani neukládá. Školní profilové fotografie neimportujeme.",
            "Při spojení se serverem infrastruktura zpracovává IP adresu a technické údaje požadavku. Pokud nám napíšete, zpracujeme obsah a kontaktní údaje vaší zprávy.",
          ],
        },
        {
          title: "Účel a právní základ",
          paragraphs: [
            "Účet, import rozvrhu, vlastní události a sdílení, které si nastavíte, zpracováváme pro poskytnutí vámi vyžádané služby podle čl. 6 odst. 1 písm. b) GDPR. Bez školního identifikátoru a oprávnění nelze osobní rozvrh načíst; analytiku můžete odmítnout bez omezení aplikace.",
            "Přiměřené zabezpečení a řešení zneužití vycházejí z oprávněného zájmu na bezpečném provozu (písm. f). Vyřízení zákonných žádostí vychází z právní povinnosti (písm. c). Volitelné měření návštěv vychází z vašeho souhlasu (písm. a). Neprodáváme údaje, nezobrazujeme cílenou reklamu a nepoužíváme rozhodování s právními či obdobně závažnými účinky ani reklamní profily osob.",
          ],
        },
        {
          title: "Kdo údaje uvidí",
          paragraphs: [
            "Rozvrh není veřejný. Zpřístupní se přijatým přátelům nebo členům skupin podle vašich oprávnění. Jméno a školní uživatelské jméno jsou viditelné tam, kde jsou potřebné pro pozvání a správu vztahu; členové skupiny vidí její členství. Sdílení skupině zahrnuje současné i budoucí přijaté členy. Individuální nastavení má přednost; blokace zastaví sdílení oběma směry.",
            "Vlastní události a jejich poznámky se sdílí spolu s rozvrhem. Nevkládejte citlivé údaje, například o zdraví, ani cizí údaje bez oprávnění. Sdílení můžete změnit či odvolat, ale nelze odvolat kopie nebo snímky, které příjemce již vytvořil. Odchod z jedné skupiny nemusí ukončit přístup udělený jiným vztahem.",
            "Provozovatel přistupuje k údajům jen pro provoz, podporu, zabezpečení a vyřízení práv. Údaje mohou být vydány příslušnému orgánu, vyžaduje-li to zákon.",
          ],
        },
        {
          title: "Poskytovatelé a umístění",
          paragraphs: [
            "Databáze, zálohy a naše instance Umami jsou hostovány u Hetzner Online GmbH v Německu na sdíleném serveru. K serveru má vedle provozovatele administrátorský přístup také externí správce serveru; tento přístup mu technicky umožňuje přistupovat k uloženým údajům. Cloudflare zprostředkovává požadavky a odpovědi webu pro doručování a ochranu a zpracovává související síťové údaje včetně IP adresy. Přihlášení a zdrojový rozvrh zajišťuje ČVUT podle svých pravidel.",
            "Kontaktní schránka je Gmail (Google); zprávy a jejich metadata proto zpracovává také poskytovatel pošty. Cloudflare a Google využívají globální infrastrukturu, takže u nich může docházet ke zpracování mimo EHP. Jejich dokumenty popisují příslušné záruky včetně standardních smluvních doložek a rozhodnutí o odpovídající ochraně, jsou-li použitelné. O informace k našemu konkrétnímu zpracování můžete požádat na kontaktním e-mailu. Nikdy neposílejte hesla ani přístupové tokeny. Z rozvrhu posílejte jen údaje nezbytné pro vyřešení žádosti.",
          ],
          links: providers,
        },
        {
          title: "Doba uchování",
          items: [
            "Účet a související údaje uchováváme do jeho smazání. Po 365 dnech bez aktivity přihlášeného uživatele účet automaticky odstraní denní úklid. Synchronizace na pozadí tuto lhůtu neprodlužuje. Smazání odstraní i skupiny, které vlastníte, a členství v ostatních skupinách.",
            "Zálohy se při běžném monitorovaném provozu obměňují během sedmi dnů; mezitím mohou obsahovat dříve smazaná data a neslouží k běžnému používání. Při obnově je nutné znovu provést dřívější výmazy.",
            "Přihlašovací relace platí nejvýše 30 dní a stav školního přihlášení 10 minut. Odkazy s pozvánkou platí 7 dní; expirované záznamy se průběžně odstraňují. Nevyřízené žádosti o přátelství či členství zůstávají do jejich vyřízení, zrušení nebo smazání účtu či skupiny.",
            "Analytické záznamy starší 90 dní odstraňuje hodinový úklid. Korespondenci běžně uchováváme 12 měsíců po vyřízení; nezbytné podklady k právnímu nároku či povinnosti pouze po odůvodněnou dobu.",
            "Bezpečnostní podklady uchováváme po dobu potřebnou k vyřešení konkrétní události a případné právní ochraně. U technických údajů zpracovávaných poskytovateli infrastruktury se uplatní také jejich pravidla uchování uvedená v odkazech výše.",
          ],
        },
        {
          title: "Cookies, úložiště a analytika",
          paragraphs: [
            "Nezbytné cookies kwf_session (30 dní) a kwf_oauth (10 minut) slouží k přihlášení a jeho ochraně. Místní úložiště si pamatuje jazyk, téma a zobrazení dne do změny či vymazání. Dočasné úložiště drží pozvánku ke skupině pro přihlášení v téže kartě; PWA ukládá veřejné ikony a offline stránku, nikoli rozvrhy. Síťová ochrana Cloudflare může při bezpečnostní výzvě použít nezbytné bezpečnostní úložiště.",
            "Po výslovném povolení odesíláme do vlastního Umami záznam o zobrazení předem dané obrazovky. Umami záznamy počítá a uchovává čas události. Nepředáváme jména, účty, rozvrhy, texty, adresy s parametry, pozvánky ani původní IP adresu či identifikaci prohlížeče. Nejde o počítání jedinečných lidí. Pro analytiku nepoužíváme nahrávání obrazovky ani otisky zařízení.",
            "Volbu analytiky s verzí a datem si toto zařízení pamatuje šest měsíců. V Nastavení analytiky v patičce ji kdykoli změníte; odmítnutí je stejně dostupné jako přijetí. Do Not Track a Global Privacy Control měření vypnou. Odvolání působí do budoucna; Umami neuchovává vazbu na váš účet, podle které bychom v něm mohli vyhledat vaše jednotlivé záznamy.",
          ],
        },
        {
          title: "Vaše práva a kontakt",
          paragraphs: [
            "V Účtu můžete stáhnout vlastní data ve formátu JSON nebo účet smazat. Tím se nemění školní evidence; oprávnění udělené této aplikaci lze samostatně odvolat ve správě školních aplikací. Nesprávné školní údaje opravte u školy, vlastní události přímo v aplikaci.",
            "Na tkdeeev@gmail.com můžete požádat o přístup, opravu, výmaz, omezení zpracování či přenositelnost za podmínek GDPR a vznést námitku proti zpracování založenému na oprávněném zájmu. Přiměřeně ověříme totožnost; běžně odpovíme do jednoho měsíce. U složitých žádostí lze lhůtu prodloužit nejvýše o další dva měsíce a včas vám vysvětlíme proč. Můžete podat stížnost ÚOOÚ. Změny tohoto dokumentu označujeme novým datem; významné změny oznámíme v aplikaci.",
          ],
          links: authority,
        },
      ],
    },
    terms: {
      title: "Podmínky používání",
      intro:
        "KOSwFriends je bezplatná aplikace pro vlastní rozvrh a dobrovolné sdílení. Provozuje ji Tomáš Viktor Kubíček (TKDEV), tkdeeev@gmail.com, jako nezávislý studentský projekt.",
      sections: [
        {
          title: "Vztah ke škole",
          paragraphs: [
            "Aplikace není oficiální službou ČVUT ani FIT ČVUT a tyto instituce ji neprovozují. Školní přihlášení umožňuje oprávněný přístup k vašim údajům; neznamená doporučení aplikace školou. Aplikace čte školní rozvrh a neprovádí zápis předmětů ani jiné změny v KOS. Rozhodující zůstávají oficiální školní systémy a pokyny školy.",
          ],
        },
        {
          title: "Používání a účet",
          paragraphs: [
            "Přihlášením žádáte o vytvoření nebo používání osobního účtu podle těchto podmínek. Používejte pouze svůj školní účet, chraňte přístup a dodržujte pravidla školních API. Pro používání není nutné povolit analytiku. Experimentální funkce nemusí být dokončené; dostupnost a úplnost importu závisí také na škole.",
          ],
        },
        {
          title: "Sdílení a vlastní obsah",
          paragraphs: [
            "Před odesláním žádosti nebo připojením ke skupině zkontrolujte, co sdílíte. Udělený přístup zahrnuje i vlastní události a poznámky. Obsah vkládejte jen v rozsahu, ke kterému máte oprávnění. Nesdílejte cizí rozvrhy mimo zamýšlené příjemce, neobtěžujte ostatní, neobcházejte oprávnění ani hromadně nesbírejte údaje. Zneužití nebo bezpečnostní chybu nahlaste na kontaktní e-mail bez zveřejnění osobních údajů.",
          ],
        },
        {
          title: "Spolehlivost a odpovědnost",
          paragraphs: [
            "Rozvrh může být opožděný, odhadovaný nebo dočasně nedostupný. Důležité termíny ověřujte ve školních systémech. Budeme usilovat o nápravu oznámených chyb, ale neslibujeme nepřetržitou dostupnost. Tato pravidla nevylučují ani neomezují odpovědnost, kterou podle použitelného práva omezit nelze.",
          ],
        },
        {
          title: "Ukončení a změny",
          paragraphs: [
            "Účet můžete kdykoli smazat a předtím stáhnout vlastní data. Po 365 dnech bez aktivity přihlášeného uživatele se účet odstraní včetně vlastněných skupin. Přístup lze přiměřeně omezit při zneužití nebo bezpečnostním incidentu; důvod sdělíme, nebrání-li tomu zákon či ochrana služby. Podstatné změny pravidel nebo ukončení služby oznámíme s přiměřeným předstihem, pokud je to možné; naléhavé bezpečnostní zásahy mohou být okamžité.",
          ],
        },
        {
          title: "Zdrojový kód a práva",
          paragraphs: [
            "Vlastní zdrojový kód projektu je zveřejněn pod licencí MIT. Licence kódu neposkytuje práva ke školním datům, osobním údajům ani cizím ochranným známkám. Cizí součásti se řídí vlastními licencemi uvedenými v repozitáři. Případné spory řešíme nejprve přes kontaktní e-mail; použitelné české a unijní právo a vaše kogentní práva zůstávají zachovány.",
          ],
          links: [
            {
              label: "GitHub — kód a licence",
              href: "https://github.com/tkdeeev/koswfriends",
            },
          ],
        },
      ],
    },
  },
  en: {
    updated: "Effective",
    back: "Back to app",
    privacy: {
      title: "Privacy notice",
      intro:
        "KOSwFriends is operated by Tomáš Viktor Kubíček (TKDEV), an individual and the data controller. Contact for privacy and data rights: tkdeeev@gmail.com. This is an independent student project, not a service operated by CTU.",
      sections: [
        {
          title: "Information we process",
          items: [
            "After school sign-in: school username, school-provided name, internal ID, selected semester, account creation and last activity times. School information comes from CTU OAuth and Sirius.",
            "Your timetable: courses, lesson titles and IDs, type, group, times, room and cancellation status. We retain the last successful import for semesters you select.",
            "Personal events, recurrence, colors and notes; any semester drafts; friend requests, groups, memberships, invitations, blocks and sharing preferences.",
            "Encrypted school access/refresh tokens, login sessions and security information. The app never receives or stores your school password. We do not import school profile photos.",
            "When connecting, the infrastructure processes your IP address and technical request information. If you contact us, we process your message and contact details.",
          ],
        },
        {
          title: "Purposes and legal bases",
          paragraphs: [
            "Accounts, timetable imports, personal events and sharing you request are processed to provide the requested service under GDPR Article 6(1)(b). Your school identifier and authorization are necessary to import a personal timetable. Refusing analytics does not restrict the app.",
            "Proportionate security and abuse prevention rely on our legitimate interest in safe operation (Article 6(1)(f)). Handling statutory rights requests relies on legal obligations (c). Optional usage measurement relies on consent (a). We do not sell data, display targeted advertising, create advertising profiles or make automated decisions with legal or similarly significant effects.",
          ],
        },
        {
          title: "Who can see information",
          paragraphs: [
            "Timetables are not public. Accepted friends or group members receive access according to your settings. Names and usernames appear where needed to invite and manage connections; group members can see membership. Group sharing covers current and future accepted members. Individual overrides take priority; blocking stops sharing in both directions.",
            "Personal events and notes follow timetable sharing. Do not enter sensitive details, such as health information, or other people's data without permission. You can change or revoke access, but cannot recall screenshots or copies already made by recipients. Leaving one group may not remove access granted through another relationship.",
            "The operator accesses data only for operation, support, security and rights requests. Information may be disclosed to a competent authority where required by law.",
          ],
        },
        {
          title: "Providers and locations",
          paragraphs: [
            "The database, backups and our Umami instance run on a shared server hosted by Hetzner Online GmbH in Germany. An external server administrator also has administrative access alongside the operator; this technically allows access to stored data. Cloudflare handles website requests and responses for delivery and protection, along with related network information including IP addresses. CTU provides school authentication and source timetables under its own rules.",
            "Our contact mailbox uses Gmail (Google), so the email provider also processes correspondence and metadata. Cloudflare and Google operate globally and may process information outside the EEA. Their documents describe relevant safeguards, including standard contractual clauses and adequacy decisions where applicable. Contact us for details about our specific processing. Never send passwords or access tokens. Include only timetable details necessary to resolve your request.",
          ],
          links: providers,
        },
        {
          title: "Retention",
          items: [
            "Account data is kept until deletion. Daily cleanup automatically removes accounts after 365 days without activity by a signed-in user; background imports do not extend this period. Deletion also removes groups you own and your memberships in other groups.",
            "Under normal monitored operation, backups rotate within seven days. They may temporarily contain deleted data and are not used for ordinary access. Previous deletions must be reapplied when restoring a backup.",
            "Login sessions last up to 30 days and school-login state lasts 10 minutes. Invitation links expire after seven days; expired records are removed periodically. Pending friend or membership requests remain until resolved, cancelled or removed with the account or group.",
            "Hourly cleanup removes analytics records older than 90 days. Correspondence is normally kept for 12 months after resolution; records necessary for a specific legal obligation or claim are retained only for a justified period.",
            "Security evidence is kept as needed to resolve a specific incident and address related legal claims. Infrastructure providers also apply their retention rules to technical information they process, as described in the linked documents above.",
          ],
        },
        {
          title: "Cookies, storage and analytics",
          paragraphs: [
            "Necessary cookies kwf_session (30 days) and kwf_oauth (10 minutes) support sign-in and its security. Local storage remembers language, theme and day layout until changed or cleared. Session storage holds a group invitation through sign-in in the same tab. The PWA caches public icons and an offline page, not timetables. Cloudflare protection may use necessary security storage when presenting a security challenge.",
            "After explicit permission, we send a view event for a predefined app screen to our own Umami instance. Umami counts these events and records their time. We do not forward names, accounts, calendars, entered text, query strings, invitation links, original visitor IP addresses or browser identifiers. This does not measure unique people. Analytics does not use session recording or device fingerprinting.",
            "This device remembers your analytics choice, policy version and date for six months. Change it at any time through Analytics settings in the footer; declining is as easy as accepting. Do Not Track and Global Privacy Control disable collection. Withdrawal stops future collection. Umami keeps no link to your account that would let us locate your individual entries there.",
          ],
        },
        {
          title: "Your rights and contact",
          paragraphs: [
            "Account settings let you download your own data as JSON or delete the account. This does not change school records; school app authorization can be revoked separately in the school's application manager. Correct source school information with the school and edit personal events in the app.",
            "Email tkdeeev@gmail.com to request access, correction, erasure, restriction or portability where GDPR conditions apply, or object to legitimate-interest processing. We will verify identity proportionately and normally respond within one month. Complex requests may require up to two additional months; we will explain this within the initial month. You may complain to the Czech data protection authority, ÚOOÚ. Revisions carry a new effective date; material changes will be announced in the app.",
          ],
          links: authority,
        },
      ],
    },
    terms: {
      title: "Terms of use",
      intro:
        "KOSwFriends is a free app for your timetable and voluntary sharing. It is operated by Tomáš Viktor Kubíček (TKDEV), tkdeeev@gmail.com, as an independent student project.",
      sections: [
        {
          title: "Relationship to the university",
          paragraphs: [
            "The app is not an official CTU or FIT CTU service and is not operated by those institutions. School sign-in authorizes access to your information; it does not mean the university endorses the app. The app reads timetables and does not enroll subjects or change KOS records. Official university systems and instructions remain authoritative.",
          ],
        },
        {
          title: "Using your account",
          paragraphs: [
            "Signing in requests creation or use of a personal account under these terms. Use only your own school account, protect access and follow school API rules. Analytics permission is optional. Experimental features may be incomplete; availability and complete imports also depend on school services.",
          ],
        },
        {
          title: "Sharing and content",
          paragraphs: [
            "Review sharing choices before sending a request or joining a group. Timetable access includes personal events and notes. Enter only information you are entitled to use. Do not redistribute others' timetables beyond intended recipients, harass people, bypass access controls or collect information in bulk. Report abuse or security issues to the contact email without publicly disclosing personal information.",
          ],
        },
        {
          title: "Reliability and responsibility",
          paragraphs: [
            "Timetables may be delayed, estimated or temporarily unavailable. Check important dates in official school systems. We aim to fix reported problems but do not promise uninterrupted availability. These terms do not exclude or limit liability that cannot lawfully be excluded or limited.",
          ],
        },
        {
          title: "Ending use and changes",
          paragraphs: [
            "You may download your data and delete your account at any time. Accounts are removed after 365 days without signed-in user activity, including groups they own. Access may be proportionately restricted for abuse or a security incident; we will explain the reason unless law or service protection prevents this. Where possible, we will give reasonable notice of material terms changes or service closure; urgent security action may be immediate.",
          ],
        },
        {
          title: "Source code and rights",
          paragraphs: [
            "The project's own source code is available under the MIT license. The code license does not grant rights to university data, personal information or third-party trademarks. Third-party components retain their own licenses, listed in the repository. Please contact us first about disputes; applicable Czech and EU law and mandatory user rights remain unaffected.",
          ],
          links: [
            {
              label: "GitHub — code and licenses",
              href: "https://github.com/tkdeeev/koswfriends",
            },
          ],
        },
      ],
    },
  },
  uk: {
    updated: "Чинне з",
    back: "До застосунку",
    privacy: {
      title: "Захист персональних даних",
      intro:
        "KOSwFriends підтримує Tomáš Viktor Kubíček (TKDEV), фізична особа та контролер персональних даних. Контакт із питань приватності та прав: tkdeeev@gmail.com. Це незалежний студентський проєкт, а не сервіс, яким керує ČVUT.",
      sections: [
        {
          title: "Які дані ми обробляємо",
          items: [
            "Після входу через університет: ім’я користувача, надане університетом ім’я, внутрішній ідентифікатор, обраний семестр, час створення та останньої активності облікового запису. Джерело університетських даних — OAuth та Sirius ČVUT.",
            "Ваш розклад: предмети, назви й ідентифікатори занять, тип, група, час, аудиторія та скасування. Зберігаємо останній успішний імпорт для обраних семестрів.",
            "Власні події, повторення, кольори й нотатки; чернетки семестру; запити дружби, групи, членство, запрошення, блокування та налаштування доступу.",
            "Зашифровані токени доступу й оновлення університету, сеанси входу та дані безпеки. Застосунок не отримує й не зберігає університетський пароль. Фотографії профілю не імпортуються.",
            "Під час з’єднання інфраструктура обробляє IP-адресу й технічні дані запиту. Якщо ви звернетеся до нас, обробляємо зміст повідомлення та контактні дані.",
          ],
        },
        {
          title: "Мета та правові підстави",
          paragraphs: [
            "Обліковий запис, імпорт розкладу, власні події й замовлений вами доступ обробляються для надання послуги за статтею 6(1)(b) GDPR. Без університетського ідентифікатора й дозволу імпортувати особистий розклад неможливо. Відмова від аналітики не обмежує застосунок.",
            "Пропорційна безпека й запобігання зловживанням ґрунтуються на законному інтересі безпечної роботи (6(1)(f)), виконання запитів щодо законних прав — на правовому обов’язку (c), необов’язкова аналітика — на згоді (a). Ми не продаємо дані, не показуємо цільову рекламу, не створюємо рекламних профілів і не ухвалюємо автоматизованих рішень із правовими чи подібними істотними наслідками.",
          ],
        },
        {
          title: "Хто бачить дані",
          paragraphs: [
            "Розклади не є публічними. Прийняті друзі або учасники груп отримують доступ відповідно до ваших налаштувань. Ім’я та університетське ім’я користувача відображаються там, де це потрібно для запрошення й керування контактами; учасники груп бачать її склад. Доступ групі охоплює нинішніх і майбутніх прийнятих учасників. Особисті винятки мають пріоритет; блокування припиняє доступ в обох напрямках.",
            "Власні події та нотатки доступні разом із розкладом. Не вводьте чутливі дані, наприклад про здоров’я, або чужі дані без дозволу. Доступ можна змінити чи відкликати, але вже зроблені копії та знімки одержувачів повернути неможливо. Вихід з однієї групи не завжди припиняє доступ через інший зв’язок.",
            "Оператор працює з даними лише для надання послуги, підтримки, безпеки та виконання прав. Дані можуть бути передані компетентному органу, якщо цього вимагає закон.",
          ],
        },
        {
          title: "Постачальники та місце обробки",
          paragraphs: [
            "База даних, резервні копії та наш Umami розміщені на спільному сервері Hetzner Online GmbH у Німеччині. Крім оператора, адміністративний доступ має зовнішній адміністратор сервера; це технічно дає йому доступ до збережених даних. Cloudflare обробляє запити й відповіді вебсайту для доставки та захисту разом із пов’язаними мережевими даними, зокрема IP-адресами. ČVUT надає університетський вхід і вихідні розклади за власними правилами.",
            "Контактна скринька працює через Gmail (Google), тому поштовий провайдер також обробляє листування й метадані. Cloudflare та Google мають глобальну інфраструктуру й можуть обробляти дані поза ЄЕЗ. Їхні документи описують застосовні гарантії, зокрема стандартні договірні положення й рішення про належний захист. Подробиці нашої конкретної обробки можна запитати електронною поштою. Ніколи не надсилайте паролі чи токени доступу. З розкладу надсилайте лише дані, необхідні для вирішення звернення.",
          ],
          links: providers,
        },
        {
          title: "Строки зберігання",
          items: [
            "Дані облікового запису зберігаються до видалення. Щоденне очищення автоматично видаляє облікові записи після 365 днів без активності користувача, який увійшов; фоновий імпорт не продовжує цей строк. Також видаляються групи, якими ви володієте, та ваше членство в інших групах.",
            "За звичайної контрольованої роботи резервні копії оновлюються протягом семи днів. Тимчасово вони можуть містити видалені дані й не використовуються для звичайного доступу. Після відновлення попередні видалення потрібно застосувати повторно.",
            "Сеанс входу діє до 30 днів, стан університетського входу — 10 хвилин. Посилання із запрошеннями діють сім днів; прострочені записи періодично видаляються. Нерозглянуті запити дружби чи членства зберігаються до їх вирішення, скасування або видалення облікового запису чи групи.",
            "Щогодинне очищення видаляє аналітичні записи, старші за 90 днів. Листування зазвичай зберігається 12 місяців після вирішення; необхідні матеріали для конкретного правового обов’язку або вимоги — лише протягом обґрунтованого строку.",
            "Матеріали щодо безпеки зберігаються стільки, скільки потрібно для вирішення конкретного інциденту та пов’язаних правових вимог. До технічних даних постачальники інфраструктури також застосовують власні правила зберігання, описані в документах за посиланнями вище.",
          ],
        },
        {
          title: "Cookies, сховище та аналітика",
          paragraphs: [
            "Необхідні cookies kwf_session (30 днів) і kwf_oauth (10 хвилин) забезпечують вхід і його захист. Локальне сховище пам’ятає мову, тему й вигляд дня до зміни або очищення. Сховище вкладки тримає запрошення до групи під час входу в тій самій вкладці. PWA кешує публічні іконки й офлайн-сторінку, а не розклади. Захист Cloudflare може використовувати необхідне сховище під час перевірки безпеки.",
            "Лише після явного дозволу наш Umami отримує подію перегляду визначеного екрана. Umami підраховує ці події та зберігає їхній час. Ми не передаємо імена, облікові записи, розклади, введені тексти, параметри адрес, запрошення, оригінальні IP-адреси відвідувачів чи ідентифікацію браузера. Це не підрахунок унікальних людей. Аналітика не використовує запис сеансів чи цифрові відбитки пристроїв.",
            "Пристрій пам’ятає ваш вибір аналітики, версію та дату шість місяців. Змінити його можна в Налаштуваннях аналітики у підвалі; відмовитися так само легко, як погодитися. Do Not Track і Global Privacy Control вимикають збір. Відкликання припиняє майбутній збір. Umami не зберігає зв’язку з вашим обліковим записом, за яким ми могли б знайти там ваші окремі записи.",
          ],
        },
        {
          title: "Ваші права та звернення",
          paragraphs: [
            "У налаштуваннях можна завантажити власні дані як JSON або видалити обліковий запис. Університетські записи при цьому не змінюються; дозвіл застосунку можна окремо відкликати у менеджері університетських застосунків. Помилки у вихідних даних виправляйте в університеті, власні події — у застосунку.",
            "Напишіть на tkdeeev@gmail.com, щоб за умов GDPR отримати доступ, виправлення, видалення, обмеження чи перенесення даних або заперечити проти обробки на основі законного інтересу. Ми пропорційно перевіримо особу й зазвичай відповімо протягом місяця. Для складних запитів можливе продовження ще на два місяці з поясненням протягом першого місяця. Можна подати скаргу до чеського органу захисту даних ÚOOÚ. Нові редакції мають нову дату; про істотні зміни повідомимо в застосунку.",
          ],
          links: authority,
        },
      ],
    },
    terms: {
      title: "Умови користування",
      intro:
        "KOSwFriends — безплатний застосунок для вашого розкладу й добровільного доступу. Його підтримує Tomáš Viktor Kubíček (TKDEV), tkdeeev@gmail.com, як незалежний студентський проєкт.",
      sections: [
        {
          title: "Відносини з університетом",
          paragraphs: [
            "Це не офіційний сервіс ČVUT чи FIT ČVUT, і ці установи ним не керують. Університетський вхід дозволяє отримати ваші дані, але не означає схвалення застосунку університетом. Застосунок читає розклади, не записує на предмети й не змінює записи KOS. Визначальними залишаються офіційні університетські системи та вказівки.",
          ],
        },
        {
          title: "Користування обліковим записом",
          paragraphs: [
            "Вхід означає запит на створення чи використання особистого облікового запису за цими умовами. Користуйтеся лише власним університетським обліковим записом, захищайте доступ і дотримуйтеся правил університетських API. Аналітика необов’язкова. Експериментальні функції можуть бути незавершеними; доступність і повнота імпорту також залежать від університету.",
          ],
        },
        {
          title: "Доступ і власний вміст",
          paragraphs: [
            "Перевірте дозволи перед надсиланням запиту чи вступом у групу. Доступ до розкладу охоплює власні події та нотатки. Додавайте лише інформацію, на використання якої маєте право. Не поширюйте чужі розклади поза призначеними одержувачами, не переслідуйте людей, не обходьте дозволи й не збирайте дані масово. Про зловживання чи вразливості повідомляйте контактною поштою без публікації персональних даних.",
          ],
        },
        {
          title: "Надійність і відповідальність",
          paragraphs: [
            "Розклади можуть бути застарілими, приблизними або тимчасово недоступними. Перевіряйте важливі дати в офіційних системах. Ми прагнемо виправляти повідомлені помилки, але не обіцяємо безперервної доступності. Ці умови не виключають і не обмежують відповідальність, яку закон не дозволяє виключити чи обмежити.",
          ],
        },
        {
          title: "Припинення користування та зміни",
          paragraphs: [
            "Ви можете будь-коли завантажити дані й видалити обліковий запис. Після 365 днів без активності користувача, який увійшов, його видаляють разом із належними йому групами. Доступ може бути пропорційно обмежено через зловживання чи загрозу безпеці; причину повідомимо, якщо закон або захист сервісу цьому не перешкоджають. За можливості завчасно повідомимо про істотні зміни умов або закриття сервісу; термінові заходи безпеки можуть бути негайними.",
          ],
        },
        {
          title: "Код і права",
          paragraphs: [
            "Власний код проєкту доступний за ліцензією MIT. Ліцензія коду не надає прав на університетські або персональні дані чи чужі торговельні марки. Сторонні компоненти зберігають власні ліцензії, зазначені в репозиторії. Щодо спорів спершу звертайтеся контактною поштою; застосовне чеське й європейське право та обов’язкові права користувачів залишаються чинними.",
          ],
          links: [
            {
              label: "GitHub — код і ліцензії",
              href: "https://github.com/tkdeeev/koswfriends",
            },
          ],
        },
      ],
    },
  },
};
