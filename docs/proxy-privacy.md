# Scoped proxy access logging

The production Traefik 3.6.7 instance has access logging enabled globally for hosted applications. KOSwFriends OAuth callbacks and invitation URLs can contain secrets, so the two dedicated hosts use routers that opt out of access logging and tracing:

- `kos.deeev.cz`
- `analytics.deeev.cz`

The file-provider configuration lives at `/etc/dokploy/traefik/dynamic/koswfriends-privacy.yml` and is managed through Dokploy's `settings.updateTraefikFile`. Four host-only routers, one HTTP and one HTTPS router per host, use priority `10000` and `observability: { accessLogs: false, tracing: false }`.

These routers refer to the existing generated Docker services, preserving automatic container discovery:

| Host                 | HTTP service                             | HTTPS service                                  |
| -------------------- | ---------------------------------------- | ---------------------------------------------- |
| `kos.deeev.cz`       | `koswfriends-byzhyw-16-web@docker`       | `koswfriends-byzhyw-16-websecure@docker`       |
| `analytics.deeev.cz` | `koswfriends-umami-sn2aks-17-web@docker` | `koswfriends-umami-sn2aks-17-websecure@docker` |

HTTP retains `redirect-to-https@file`. HTTPS retains the existing `letsencrypt` certificate resolver. No global access-log configuration or unrelated router is changed, and the file watcher applies updates without a proxy restart.

Do not try to move these settings into the compose service's `traefik.*` labels: the installed Dokploy generates that namespace and strips those additional labels during compose conversion. After changing Dokploy domain entries or service names, verify the table above still matches the generated Docker services. Otherwise the higher-priority file routers could point to a missing backend. Ordinary application releases keep the same service names.

Validate changes using Traefik's internal runtime API: all four `koswfriends-*-private-*`/`koswfriends-private-*` file routers must be enabled, have priority `10000`, and report access logging and tracing disabled. Check the public application health endpoint, dashboard and both HTTP-to-HTTPS redirects afterward. Do not expose the internal Traefik API publicly.

Rollback affects only this file: replace its contents with `http: { routers: {} }` through the same management endpoint. The original Dokploy-generated routes then resume handling these hosts. This also restores their previous logging behavior, so assess secret logging before leaving that rollback in place.

This configuration prevents new access-log entries for these routes. It does not erase historical logs, control hosting management/error logs, or change Cloudflare's account and security logging. The two domains are proxied by Cloudflare; its processing, contractual safeguards and retention must be covered separately in the operator's privacy documentation and provider arrangements.

[Traefik 3.6 per-router observability reference](https://doc.traefik.io/traefik/v3.6/reference/routing-configuration/http/routing/observability/)
