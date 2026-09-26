# Optional analytics

KOSwFriends counts visits to fixed application sections only after the visitor chooses **Allow**. The application works normally after **Decline**. The footer's **Analytics settings** button allows withdrawal at any time. Both choices expire after 183 days; a new affirmative choice is then required. A browser's Do Not Track or Global Privacy Control signal disables collection even when an earlier acceptance is stored.

The browser keeps only the choice, policy version and choice timestamp in `kwf_analytics_choice` in local storage. It sends `{ "page": "timetable" }`, or another explicitly listed section, to the same-origin `/api/usage` endpoint without cookies, credentials or a referrer. No third-party tracking script is installed.

The server rejects unknown fields and categories and rebuilds the Umami event. It does not forward visitor IP addresses, user agents, screen sizes, account identifiers, names, timetables, form contents, URLs, query strings, fragments, invitation tokens or referrers. Umami receives a fixed loopback IP and a fixed application identifier instead of visitor characteristics. This minimizes analytics data; the application's ordinary network and account processing is described separately in the privacy notice.

Only page counts and their times/categories are useful in this configuration. Umami's unique visitor, device, location, journey and visitor-retention metrics do **not** represent actual people. Do not present them as user counts. Session replay, heatmaps, identification, custom event properties and cross-site tracking are not integrated.

## Server configuration

The web process needs three runtime variables:

| Variable           | Purpose                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `UMAMI_ENABLED`    | Must be exactly `true`; otherwise collection and the initial choice prompt remain disabled. |
| `UMAMI_URL`        | Fixed origin of the dedicated self-hosted Umami instance. Never derived from a request.     |
| `UMAMI_WEBSITE_ID` | UUID of the KOSwFriends website entry.                                                      |

Keep administrator credentials outside this repository and outside the application environment. The collection endpoint does not need an Umami administrator token. Browser requests and the Umami response are not logged by this code, and Umami's session token is discarded.

The production instance uses its own database and private Docker network. `PRIVATE_MODE=1` and `DISABLE_TELEMETRY=1` disable Umami's external telemetry. `DISABLE_BOT_CHECK=1` is required for the deliberately generic server-side counter; no visitor browser identification is substituted. The application talks to a dedicated alias over the existing Docker network, while dashboard administration uses HTTPS separately.

## Retention and maintenance

The dedicated Umami deployment contains an hourly `retention` service. It deletes analytics rows older than 90 days, within one hourly cycle, and removes old sessions without remaining events. Every statement is scoped to the KOSwFriends website UUID and the transaction verifies that the website domain is `kos.deeev.cz`. It covers events, event data, session data and links, revenue, replay and heatmap tables in the pinned Umami 3.4.0 schema. The application does not generate the latter features, but they are included so accidental activation does not evade the retention limit.

The retention container records only completion and row counts. Its health check becomes unhealthy if successful cleanup stops. Monitor that health status. Review the cleanup schema before upgrading Umami; do not silently add analytics databases to longer-lived backups. No analytics database backup service is configured in this dedicated deployment.

Synthetic validation inserts old and recent rows within a transaction, applies the retention statements, verifies old rows are removed and recent rows survive, and rolls the entire transaction back. This does not replace ongoing monitoring of the retention container.

The first-party endpoint avoids dependence on loading a third-party script or domain. Browser extensions can still block any request. Do not add alternate collection paths to evade a visitor's blocking decision, consent choice, DNT or GPC signal.

## References

- [Umami tracker configuration](https://docs.umami.is/docs/tracker-configuration)
- [Umami environment variables](https://docs.umami.is/docs/environment-variables)
- [Umami 3.4.0 collection implementation](https://github.com/umami-software/umami/blob/v3.4.0/src/app/api/send/route.ts)
- [Umami 3.4.0 database schema](https://github.com/umami-software/umami/blob/v3.4.0/prisma/schema.prisma)
