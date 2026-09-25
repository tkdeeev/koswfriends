/** CTU username SSSSSFFF: initial of surname, then first name. */
export function initials(username: string) {
  const letters = Array.from(username.trim());
  return `${letters[0] || "?"}${letters[5] || letters[1] || ""}`.toUpperCase();
}
const avatarPalette = [
  "#326d9c",
  "#83639b",
  "#387869",
  "#a95b40",
  "#8b6930",
  "#8e526f",
];
export function avatarColor(username: string) {
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return avatarPalette[(hash >>> 0) % avatarPalette.length];
}
// Fittable's published palette, with dark text to keep small labels readable.
export const lessonColors: Record<string, string> = {
  lecture: "#f7c93f",
  tutorial: "#64aa47",
  laboratory: "#de5543",
  exam: "#9169b5",
  assessment: "#9169b5",
  course_event: "#79b7d5",
  teacher_timetable_slot: "#79b7d5",
};
export function lessonColor(type: string) {
  return lessonColors[type] || "#94a9ba";
}

export function displayName(person: { name?: string; username: string }) {
  return person.name?.trim() || person.username;
}
