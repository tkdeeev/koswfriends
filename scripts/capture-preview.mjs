import { chromium } from "playwright";
import { DateTime } from "luxon";
import { mkdir } from "node:fs/promises";

// Only synthetic API data is used to publish the landing-page screenshots.
const base = "http://localhost:3100";
const now = DateTime.now().setZone("Europe/Prague");
const year = now.month < 9 ? now.year - 1 : now.year;
const semester = `B${String(year).slice(-2)}${now.month >= 2 && now.month < 9 ? 2 : 1}`;
const week = now.startOf("week");
const me = {
  id: "demo-self",
  username: "demouser",
  name: "Demo Student",
  semester,
  csrf: "demo",
  reconnect: false,
};
const friend = {
  id: "demo-friend",
  username: "demofriend",
  name: "Demo Friend",
};
const event = (id, course, cs, en, type, day, hour, room, extra = {}) => ({
  id,
  course,
  title: { cs, en },
  type,
  group: "101",
  room,
  start: week.plus({ days: day, hours: hour }).toISO(),
  end: week.plus({ days: day, hours: hour, minutes: 90 }).toISO(),
  cancelled: false,
  ...extra,
});
const events = [
  event(
    "demo-1",
    "BI-PA1",
    "Programování a algoritmizace 1",
    "Programming and Algorithmics 1",
    "lecture",
    0,
    8,
    "T9:105",
  ),
  event(
    "demo-2",
    "BI-MA1",
    "Matematika 1",
    "Mathematics 1",
    "tutorial",
    0,
    10,
    "T9:301",
  ),
  event(
    "demo-3",
    "BI-PA1",
    "Programování a algoritmizace 1",
    "Programming and Algorithmics 1",
    "laboratory",
    1,
    9,
    "T9:351",
  ),
  event(
    "demo-4",
    "BI-ULI",
    "Úvod do Linuxu",
    "Introduction to Linux",
    "lecture",
    2,
    8,
    "T9:155",
  ),
  event(
    "demo-5",
    "TV1-PE",
    "Plavání",
    "Swimming",
    "personal",
    2,
    10,
    "Podolí",
    { group: "", color: "#2b9a9a" },
  ),
  event(
    "demo-6",
    "BI-MA1",
    "Matematika 1",
    "Mathematics 1",
    "lecture",
    3,
    9,
    "T9:105",
  ),
  event(
    "demo-7",
    "BI-ULI",
    "Úvod do Linuxu",
    "Introduction to Linux",
    "tutorial",
    4,
    8,
    "T9:301",
  ),
];
const calendar = (person, lessons) => ({
  userId: person.id,
  username: person.username,
  name: person.name,
  events: lessons,
  lastSuccess: now.toISO(),
  error: null,
  semester: {
    code: semester,
    from: week.toISO(),
    to: week.plus({ weeks: 1 }).toISO(),
    verified: true,
  },
});
const responses = {
  config: { enabled: false },
  me,
  friends: { friends: [], blocked: [] },
  groups: { groups: [] },
  events: { events: [] },
  plans: { choices: [], shared: [] },
  calendar: {
    people: [friend],
    attendees: { "demo-1": [friend], "demo-3": [friend], "demo-6": [friend] },
    revoked: [],
    calendars: [
      calendar(me, events),
      calendar(friend, [
        events[0],
        events[2],
        events[5],
        event(
          "demo-overlay",
          "BI-PS1",
          "Počítačové sítě",
          "Computer Networks",
          "tutorial",
          4,
          10,
          "T9:341",
        ),
      ]),
    ],
  },
};
await mkdir("public/preview", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 940 },
    deviceScaleFactor: 1,
    locale: "en-GB",
    serviceWorkers: "block",
  });
  await page.route("**/api/**", async (route) => {
    const key = new URL(route.request().url()).pathname.split("/").at(-1);
    if (!(key in responses) || route.request().method() !== "GET")
      throw Error("Unexpected preview API request");
    await route.fulfill({ json: responses[key] });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator("[data-lesson-type]").first().waitFor();
  for (const locale of ["cs", "en", "uk"]) {
    await page
      .getByRole("button", {
        name: locale === "cs" ? "CZ" : locale === "uk" ? "UA" : "EN",
        exact: true,
      })
      .click();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        localStorage.setItem("kwf_theme", value);
        document.documentElement.dataset.theme = value;
        window.dispatchEvent(new Event("storage"));
      }, theme);
      await page.screenshot({
        path: `public/preview/timetable-${locale}-${theme}.png`,
        animations: "disabled",
      });
    }
  }
} finally {
  await browser.close();
}
