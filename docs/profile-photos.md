# School profile photos

Checked on 2026-09-24 against the official [Umapi/Usermap v1 documentation](https://kosapi.fit.cvut.cz/usermap/doc/rest-api-v1.html).

Usermap has an OAuth-protected `GET /people/{username}/photo` endpoint returning PNG. The documentation limits it to employees whose photos are explicitly public. This does not establish a supported way to obtain student card/profile photos. Sirius personal profiles do not include a documented photo field.

KOSwFriends therefore retains the deterministic avatar using username letters one and six. It does not scrape school pages, request an additional OAuth scope, or send the existing Sirius token to a different API. Student photo integration should wait for a supported student-photo contract and the corresponding approved OAuth access.
