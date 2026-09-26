/** First and last display-name words; CTU username initials when no name is known. */
export function initials(username: string, name?: string) {
  const display = name?.normalize("NFC").trim();
  if (display && display.toLowerCase() !== username.trim().toLowerCase()) {
    const words = display.split(/\s+/u);
    return (
      Array.from(words[0])[0] +
      (words.length > 1 ? Array.from(words.at(-1)!)[0] : "")
    ).toUpperCase();
  }
  const letters = Array.from(username.trim());
  return `${letters[0] || "?"}${letters[5] || letters[1] || ""}`.toUpperCase();
}
/** Stable per-username colors across the full hue range, with contrast for white initials. */
export function avatarColor(username: string) {
  let hash = 2166136261;
  for (const char of username.trim().toLowerCase())
    hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;
  const hue = hash % 360;
  const saturation = (52 + ((hash >>> 9) % 25)) / 100;
  let lightness = (34 + ((hash >>> 17) % 10)) / 100;
  const rgb = (light: number) => {
    const a = saturation * Math.min(light, 1 - light);
    return [0, 8, 4].map((offset) => {
      const k = (offset + hue / 30) % 12;
      return Math.round(
        255 * (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
      );
    });
  };
  const luminance = (channels: number[]) =>
    channels.reduce((sum, channel, i) => {
      const value = channel / 255;
      return (
        sum +
        [0.2126, 0.7152, 0.0722][i] *
          (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      );
    }, 0);
  let channels = rgb(lightness);
  // 4.5:1 minimum, with a small margin for rounding. Yellow/green need a darker base.
  while (luminance(channels) > 0.175 && lightness > 0.2) {
    lightness -= 0.01;
    channels = rgb(lightness);
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
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
