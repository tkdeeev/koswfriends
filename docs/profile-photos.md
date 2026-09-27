# School profile photos

Checked on 2026-09-24 against the official [Umapi/Usermap v1 documentation](https://kosapi.fit.cvut.cz/usermap/doc/rest-api-v1.html).

Usermap has an OAuth-protected `GET /people/{username}/photo` endpoint returning PNG. The documentation limits it to employees whose photos are explicitly public. This does not establish a supported way to obtain student card/profile photos. Sirius personal profiles do not include a documented photo field.

The app uses initials from the first and last words of the display name, falling back to username letters one and six. It does not scrape school pages, request an additional OAuth scope, or send the existing Sirius token to a different API. Student photo integration should wait for a supported student-photo contract and the corresponding approved OAuth access.

## User uploads

Users can upload or remove their own JPG, PNG or WebP picture in Account and data. Uploads are limited to 5 MiB and 50 megapixels, decoded on the server, auto-oriented, center-cropped to 256 × 256 and re-encoded as WebP without EXIF/GPS metadata. SVG, animated and other formats are rejected. Only the processed picture is stored in PostgreSQL; the original is discarded.

The authenticated image endpoint checks current accepted friendship or shared group membership in the data-read query; blocking wins. Pictures are visible to these connections even with timetable sharing disabled. Responses are private/no-store and never enter the service worker cache. Account exports include the processed image; deletion cascades to it.
