# Privacy operations

Review date: 26 September 2026. Owner: **Tomáš Viktor Kubíček**, natural person
operating under **TKDEV**; public privacy/support contact:
**tkdeeev@gmail.com**. The service is free and is not operated by a company or
by ČVUT. These facts were supplied by the owner. This working record supports
the public privacy notice and terms; it is not a legal certification, a school
endorsement or evidence that every action below has already been completed.

Keep contracts, requests, incident evidence and any real user records outside
the public repository. Record the date, owner and evidence for completed
operational checks in a private register. Never attach tokens, session cookies,
real calendars or unredacted infrastructure logs to GitHub issues.

## Processing record

Data subjects are registered school users, people who receive requests or join
sharing groups, visitors, and people who contact the operator. School data is
obtained through the user's authorized CTU OAuth/Sirius connection; other data
comes from the user or their activity. The operator determines the purposes of
this independent service. School systems remain separately operated.

| Processing                  | Data and purpose                                                                                                                                                                    | Legal basis                                                                                          | Recipients and retention                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Account and school import   | CTU username, supplied name, internal ID, semester, activity dates, encrypted OAuth credentials, imported course/time/room/group/cancellation data; provide the requested timetable | GDPR Article 6(1)(b), service requested by the user                                                  | Operator and hosting/infrastructure providers; until deletion or daily cleanup after more than 365 days without authenticated activity      |
| Personal events and drafts  | Names, locations, times, repetition, colors, notes and draft selections; store user-created schedule content                                                                        | Article 6(1)(b)                                                                                      | Same account retention; disclosed only under applicable sharing permissions                                                                 |
| Connections and sharing     | Requests, friend/group membership, group names, directional grants, blocks and overrides; deliver requested sharing and prevent unwanted access                                     | Article 6(1)(b)                                                                                      | Accepted authorized recipients and infrastructure providers; until relationship/account removal or account retention cleanup                |
| Sessions and login state    | Opaque session-cookie hashes, CSRF value, state-binding hashes and expiry; sign in and authenticate safely                                                                          | Article 6(1)(b); necessary device storage                                                            | Session expires after 30 days; OAuth browser state after ten minutes; worker removes expired records                                        |
| Security and operation      | Necessary connection metadata, generic error codes, availability checks and proportionate incident evidence; protect users and service                                              | Article 6(1)(f), assessed below; relevant legal duties where applicable                              | Operator/infrastructure providers; minimize routine logs and verify actual provider retention; incident-specific evidence only as justified |
| Optional analytics          | Consented counts for allowlisted application screens; no school identifiers, personal content, visitor IP/UA or full URLs forwarded to Umami                                        | Article 6(1)(a), freely given analytics consent                                                      | Operator's self-hosted Umami; keep the actual configured retention and public notice aligned                                                |
| Support and rights requests | Sender/contact details, request, proportionate identity verification, actions and response                                                                                          | Article 6(1)(b) for support; 6(1)(c) for GDPR rights duties; narrowly justified 6(1)(f) for disputes | Operator and email provider; normally twelve months after closure, longer only for a recorded specific legal need                           |
| Recovery backups            | Protected copy of application database for recovery                                                                                                                                 | Article 6(1)(f), service resilience                                                                  | Restricted same-host backup storage; normal seven-day rotation, monitored as below                                                          |

Analytics choice records must contain only what is needed to honor and show the
choice, its version and time. Refusal or withdrawal must not affect access to the
application. Do not reuse operational/security data for analytics or marketing.
No automated decisions with legal or comparably significant effects are part of
the current app. Do not import teacher/student lists, photos, grades or other
school fields just because an API response happens to contain them.

## Providers and transfers

| Provider or recipient            | Actual use                                                                                                                                          | Action for operator                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hetzner Online GmbH              | Owner confirms a Germany server rented through a friend's Hetzner account                                                                           | Owner reports the friend authorized/completed the account DPA; verify parties, authority and coverage of the processing chain privately                                                    |
| External server administrator    | The account holder and operator both have server administration/root access                                                                         | Document the independent hosting/administration role and conclude binding processing instructions, confidentiality and Article 28 terms; root access is not blocked by container isolation |
| Cloudflare                       | The public site passes through its global reverse proxy/security edge; connection IP, request metadata and traffic pass through that infrastructure | Keep applicable terms/DPA and transfer safeguards; verify enabled features, logs and cache rules                                                                                           |
| Google/Gmail                     | The owner selected a Gmail contact address; incoming/outgoing correspondence and metadata are handled by Google                                     | Confirm suitable mail terms/role and transfer arrangements or use an appropriately contracted EEA mailbox; minimize message content and retention                                          |
| CTU OAuth/Sirius                 | School authentication and the user's own data source                                                                                                | Keep registration details and actual accepted API terms; do not describe CTU as operating or endorsing this app                                                                            |
| Authorized friends/group members | Recipients of the user's selected sharing                                                                                                           | Explain that revocation ends future app access but cannot recall copies already made                                                                                                       |
| Self-hosted Umami                | Software running on the operator's infrastructure                                                                                                   | Verify the deployed version, disable optional telemetry/external features and public dashboard sharing, secure administration                                                              |

Hetzner explains that a DPA can be concluded in the customer account and requires
the categories of data and people. Preserve the completed agreement privately;
the owner reported on 26 September 2026 that the friend who holds the hosting account authorized/completed its DPA. This does not establish who accepted it, the contractual parties or coverage of this application. The exact chain and agreement remain unverified. Use
[the account DPA page](https://accounts.hetzner.com/account/dpa) and
[Hetzner's data-protection guidance](https://docs.hetzner.com/general/company-and-policy/data-protection-at-hetzner/).

Cloudflare's published DPA forms part of its subscription agreement. Its GDPR
information describes international processing safeguards, including standard
contractual clauses and its applicable Data Privacy Framework certification.
Archive the agreement applicable to this account and check the actual services
and transfer basis; do not invent a requirement for a separate signed PDF if the
standard terms already incorporate it. Sources:
[Cloudflare customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
and [GDPR information](https://www.cloudflare.com/trust-hub/gdpr/).

Google's privacy policy covers received/sent email content and global processing.
Mail handling is a separate flow from the application database. Do not claim all
processing stays in Germany, or that a consumer Gmail mailbox is inherently
unlawful merely because of its brand. Review the arrangement actually used and
avoid sending tokens, unnecessary identity documents or whole calendars through
ordinary email. See [Google privacy](https://policies.google.com/privacy?hl=en)
and [transfer frameworks](https://policies.google.com/privacy/frameworks?hl=en).

## Shared server and contract chain

The owner subsequently confirmed that the Hetzner account belongs to a friend
and that both have administrative/root access. The friend was informed about
the app, and the owner reports that the friend authorized/completed the account
DPA. Do not convert those statements into a verified direct contract between
Tomáš and Hetzner, or into a signed administrator agreement.

For the disclosed independent hosting/administration arrangement, the working
model is Tomáš as controller, the external administrator as processor, and
Hetzner as a downstream processor. This assumes the administrator has no separate
purposes for app data. Record the actual role and update the model if the facts
differ. Verbal awareness alone does not replace binding processing terms and
written subprocessors authorization. The controller needs the processor's actual
identity and contact privately; the public notice can identify the recipient
category without publishing a friend's private address or personal details.

Shared hosting is not inherently prohibited. Hetzner's general terms §7 allow a
customer to grant third-party use while remaining the contractual customer.
Sections 6.2–6.3 require a separately concluded DPA and information about the data
processed. Its published sample DPA is tied to the customer's main agreement and
labels that customer the controller. Check the accepted agreement, product and
Annex 1 against this processor chain; seek a provider clarification only if that
coverage is unclear. Do not assume a label overrides actual GDPR roles. Sources:
[Hetzner terms](https://www.hetzner.com/legal/terms-and-conditions/),
[Hetzner sample DPA](https://www.hetzner.com/AV/DPA_en.pdf), and
[EDPB controller/processor guidance](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en).

A private Czech agreement template has been prepared for the two parties to
complete and accept. It is not signed and is not part of this public repository.
Do not backdate acceptance. Before representing the chain as resolved, retain
the completed agreement, actual authorization and relevant Hetzner contract.
Review all other server administrators, root access, snapshots and whole-server
backups. Containers and encrypted OAuth values do not stop a host root
administrator from accessing the database and runtime keys. Require individual
admin accounts, least privilege, confidentiality, prompt incident reporting and
restricted copies; verify actual controls rather than claiming isolation from
root. Unrelated tenants must have no access to this app's volumes, network or
secrets.

## Security legitimate-interest assessment

**Purpose.** Protect accounts, private calendars and service availability from
unauthorized access, abuse and data loss. Users reasonably expect a timetable
service to authenticate requests and recover from technical failures.

**Necessity.** Session validation, permission evaluation, minimal diagnostics and
short-lived protected backups support that purpose. Logging full request bodies,
OAuth responses, invitation fragments or personal lesson content is unnecessary.
Do not collect behavior analytics under this security purpose.

**Balancing.** Timetables and rooms can reveal people's routines. Unwanted sharing
or account compromise could expose their location or relationships. These risks
outweigh convenience where a less intrusive control works. Apply explicit
sharing, current permission checks, blocks, encryption, restricted administrator
access, limited retention and private no-store responses. Do not combine user
profiles with analytics. An objection must be considered individually; explain
any compelling reason to continue a necessary security operation.

**Conclusion to maintain.** The limited controls above support a proportionate
security/resilience purpose. This is conditional on real configuration matching
the description. Review annually, after an incident and before adding monitoring,
new recipients, location features or broader school scopes. Record actual review
completion privately; do not treat this document as that sign-off.

## Retention and deletion

`src/server/retention.ts` runs on worker startup and then daily. It removes
accounts whose last authenticated activity is more than **365 days** old.
Background synchronization does not extend that time. The deletion cascades to
school tokens, sessions, imported snapshots, drafts, personal events, invites,
permissions, memberships and groups owned by that account. Other members'
accounts and independently owned groups remain. Expired group-link secrets are
also removed; that does not remove the group or its accepted members.

Self-service deletion takes effect in the active application database immediately.
It does not erase school records or revoke the school-side OAuth authorization.
Explain the separate school revocation option. Changing or withdrawing sharing
ends the applicable access rather than deleting another person's own data.

The backup job normally rotates dumps after seven days. Check the job and oldest
file date: a stopped process cannot enforce expiry. Dumps contain personal data;
restrict access and do not copy them to unmanaged devices. Any future off-host
backup needs encryption, a defined location, retention and documented provider.

Record and enforce actual origin/proxy log settings. The application deliberately
logs generic failures; platform access logging may still contain connection data
or sensitive callback query strings. Disable unnecessary access/query logging,
limit any needed security logs, and never claim a period that was not configured.
Keep infrastructure error reporting separate from opt-in Umami. Check Cloudflare
features and browser reporting headers when the edge configuration changes.

The operator should review closed support/rights correspondence regularly and
remove it at the stated period. A legal-preservation exception needs a recorded
reason, restricted scope and review date; it is not permission to retain whole
accounts indefinitely.

## Rights-request procedure

1. Record receipt time, requested right, response deadline, responsible person and
   status in a private request register. Acknowledge without asking for unnecessary
   new personal information.
2. Verify identity proportionately, normally through the existing authenticated
   account or a suitable school-account proof. Never ask for a password, OAuth
   token or routine identity-document scan. Do not use a public GitHub issue for
   private requests.
3. Establish which records belong to the requester. An account export must exclude
   OAuth credentials, session/CSRF secrets and other people's private timetables.
   Explain sources, recipients, purposes, retention and any applicable limitations.
4. Correct app-owned data or explain where a school source must be corrected. If
   necessary restrict disputed processing while checking; do not silently dismiss
   a request merely because a value originated at school.
5. Respond without undue delay, normally within one month. If complexity permits
   an extension, notify within the first month, explain why and set the lawful
   extended deadline. Explain any refusal and the right to complain to ÚOOÚ.
6. Record the minimum evidence of fulfillment, who received any correction/deletion
   instruction and the correspondence expiry. Do not retain a duplicate export as
   routine proof. Evaluate recipients and processor assistance where relevant.

Use the [ÚOOÚ rights guidance](https://uoou.gov.cz/poradna/poradna-gdpr/prava-subjektu-udaju)
and [official contact details](https://uoou.gov.cz/kontakt). The self-service
export/delete controls supplement this process; they do not replace the other
rights or the need to handle requests from someone unable to sign in.

## Incident procedure

1. Contain the issue promptly and preserve minimal protected evidence. Depending
   on the incident, disable affected sharing, revoke sessions, stop a leaking
   endpoint or rotate compromised credentials. Preserve unrelated services.
2. Record when there was reasonable certainty of a personal-data breach, affected
   systems/data/people, confidentiality/integrity/availability impact, likely
   consequences and remediation. Document even a breach that is not reportable.
3. Assess risk to people, including leaked room/time patterns or relationship
   information. Notify the competent authority without undue delay and, where
   feasible, within 72 hours of awareness unless risk is unlikely. Do not wait
   for a complete forensic report; supplement an initial report when necessary.
4. Inform affected people without undue delay when high risk requires it. Explain
   practical protective steps and a contact. The app does not automatically know
   a contact email for every user: plan a private, lawful notification method
   before an incident, without publishing affected names or calendars.
5. Coordinate provider assistance, record the notification decision and reason,
   validate the fix, and review prevention and retention measures.

Use [EDPB breach guidance](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en)
and the [ÚOOÚ reporting procedure](https://uoou.gov.cz/profesional/poruseni-zabezpeceni-osobnich-udaju).
Do not send incident reports or user notifications automatically without a
specific authorized action and a reviewed recipient/content set.

## Restore without resurrecting deleted data

Follow [operations.md](operations.md) for isolated restore validation. Before a
production restore, determine every account/deletion or revocation that occurred
after the dump and prevent reappearance of those records and old sharing grants.
A backup alone does not provide that history. Current code does not maintain a
separate complete deletion ledger.

Use a complete protected external deletion record or a trusted current-state
comparison, and apply it before reopening access. Invalidate restored sessions,
login attempts and invite links; review restored permissions and old school
credentials. Apply retention again. Keep restoration evidence without copying
private records into the public repository.

If the required deletion/revocation history cannot be reconstructed, **do not
restore old personal rows into the public service**. Restore the schema/service
and require fresh registrations/imports, or keep the old restore isolated until
a privacy-preserving recovery is resolved. Never assume that the existence of a
backup overrides a deletion request. Rehearse this procedure on synthetic data.

## School integration, licensing and release review

- Keep the registered callback and read-only `cvut:sirius:personal:read` scope.
  Use only the signed-in person's school identity and calendar. Preserve the
  official provider origin and never ask users to give this app their school
  passwords. Link to the actual source systems without implying affiliation.
- Review any terms actually accepted for the registered app. No additional
  mandatory public-use registration was found in the public sources reviewed.
  If a term concerning retention, rate limits or user-chosen sharing is unclear,
  the operator can ask FIT API support. Do not present that inquiry as an invented
  permission requirement or claim that no terms can apply.
- Keep original author artwork and licensed fonts. ČVUT's official symbol and
  Technika font have their own protections; the app's code license does not grant
  rights in them, university datasets or user content. Preserve third-party
  notices and verify the license/provenance of any copied assets.
- Remove misleading enrollment actions or claims: all official school decisions
  and enrollment remain in school systems. A hidden planner URL is still a real
  app feature with the same privacy/security obligations.
- Review the need for a DPO and DPIA based on actual scale, risks and data types.
  Neither is automatically required just because a small app processes personal
  data. Record this screening and repeat it before expansion. GDPR accountability
  still applies to a solo operator's regular processing.

References: [CTU Apps Manager](https://auth.fit.cvut.cz/manager/index.jsf),
[Sirius API](https://cvut.github.io/sirius/docs/api-v1.html),
[KOSapi student-app support](https://kosapi.fit.cvut.cz/projects/kosapi/wiki),
[ČVUT brand guidance](https://www.cvut.cz/logo-a-graficky-manual), and
[ÚOOÚ basic guide](https://uoou.gov.cz/verejnost/zakladni-prirucka-k-ochrane-udaju).

## Operator completion record

Maintain dated evidence privately for the following; this list records required
work, not a statement that it is already complete:

- [x] Record owner confirmation (26 September 2026) that the friend holding the
      Hetzner account authorized/completed its DPA. This records the statement only.
- [ ] Verify the actual contracting parties, authority and scope of the accepted
      Hetzner DPA and coverage of the controller–administrator–host chain.
- [ ] Complete the private Article 28 administrator agreement and written
      downstream authorization; record actual privileged users and all backups.
- [ ] Retain the exact agreements privately and record this application's Germany
      deployment, subprocessors and backup location.
- [ ] Archive applicable Cloudflare terms/DPA and document enabled edge features,
      subprocessors/transfer safeguards, logs, caching and diagnostic reporting.
- [ ] Review the chosen Gmail correspondence arrangement and transfer basis or
      adopt an appropriate alternative; set a correspondence review/removal task.
- [ ] Record the exact registered school app's accepted terms and any unresolved
      ambiguity; retain any clarification supplied by the school.
- [ ] Confirm all public legal text matches the final analytics payload, retention,
      settings, provider inventory and actual deployed behavior.
- [ ] Test refusal/withdrawal, DNT/GPC, export, account deletion, group revocation,
      inactivity cutoff and no private PWA caching using synthetic accounts.
- [ ] Record actual origin/edge logs, restrict administration, verify restore and
      backup expiry, and establish deletion/revocation reconciliation evidence.
- [ ] Keep a processing/rights/incident register and complete the risk screening.
- [ ] Verify source/asset/dependency license notices before describing the app as
      open source, and repeat review when dependencies or branding change.

Review this record after material changes and at least annually. Public claims
must distinguish implemented safeguards from remaining operator confirmations;
no page or checklist establishes universal legal compliance on its own.
