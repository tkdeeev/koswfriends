import type { Text } from "@/lib/i18n";
import Icon from "./Icon";
import s from "./Workspace.module.css";

export type DayLayout = "people" | "lessons";
export default function DayLayoutToggle({
  value,
  change,
  t,
  compact = false,
}: {
  value: DayLayout;
  change: (value: DayLayout) => void;
  t: Text;
  compact?: boolean;
}) {
  return (
    <fieldset className={`${s.layoutPicker} ${compact ? s.layoutQuick : ""}`}>
      <legend>{t.dayLayout}</legend>
      {(["people", "lessons"] as const).map((layout) => {
        const label = layout === "people" ? t.byPerson : t.byLesson;
        return (
          <label key={layout} title={label}>
            <input
              type="radio"
              name={compact ? "quick-layout" : "filter-layout"}
              aria-label={label}
              value={layout}
              checked={value === layout}
              onChange={() => change(layout)}
            />
            <span>
              <Icon
                name={layout === "people" ? "peopleLayout" : "lessonLayout"}
              />
              {!compact && label}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
