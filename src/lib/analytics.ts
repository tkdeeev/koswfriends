export const ANALYTICS_CHOICE_KEY = "kwf_analytics_choice";
export const ANALYTICS_CHOICE_VERSION = 1;
export const ANALYTICS_CHOICE_TTL = 183 * 24 * 60 * 60 * 1000;
export const ANALYTICS_SETTINGS_EVENT = "kwf:analytics-settings";

export const analyticsPages = [
  "home",
  "timetable",
  "connections",
  "account",
  "planner",
  "privacy",
  "terms",
  "cookies",
] as const;
export type AnalyticsPage = (typeof analyticsPages)[number];
export type AnalyticsChoice = "accepted" | "declined";

export function readAnalyticsChoice(
  raw: string | null,
  now = Date.now(),
): AnalyticsChoice | null {
  try {
    const value = JSON.parse(raw || "null");
    if (
      value?.version === ANALYTICS_CHOICE_VERSION &&
      (value.choice === "accepted" || value.choice === "declined") &&
      Number.isFinite(value.savedAt) &&
      value.savedAt <= now &&
      now - value.savedAt < ANALYTICS_CHOICE_TTL
    )
      return value.choice;
  } catch {}
  return null;
}

export function analyticsOptOut(navigator: {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}) {
  return (
    navigator.doNotTrack === "1" ||
    navigator.doNotTrack === "yes" ||
    navigator.globalPrivacyControl === true
  );
}
