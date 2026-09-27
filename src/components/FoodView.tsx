"use client";
import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import type { MenzaMenu } from "@/server/menza";
import type { Locale, Text } from "@/lib/i18n";
import { dailyCopy } from "@/lib/daily-copy";
import { ZONE } from "@/lib/calendar";
import s from "./Daily.module.css";
import MealPhoto from "./MealPhoto";
const MENU = "https://agata.suz.cvut.cz/jidelnicky/";
export default function FoodView({ locale, t }: { locale: Locale; t: Text }) {
  const c = dailyCopy[locale];
  const [data, setData] = useState<MenzaMenu | null>(null);
  const [canteen, setCanteen] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try {
      setCanteen(localStorage.getItem("kwf_canteen") || "");
    } catch {}
  }, []);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const r = await fetch(
          `/api/menza?lang=${locale}${canteen ? `&canteen=${encodeURIComponent(canteen)}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!r.ok) {
          if (r.status === 404 && canteen) {
            setCanteen("");
            try {
              localStorage.removeItem("kwf_canteen");
            } catch {}
            return;
          }
          throw new Error();
        }
        const result = await r.json();
        if (!disposed) {
          setData(result);
          setFailed(false);
        }
      } catch {
        if (!disposed) {
          setData(null);
          setFailed(true);
        }
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    document.addEventListener("visibilitychange", load);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [locale, canteen, attempt]);
  const money = (value: string | null) =>
    value === null
      ? "—"
      : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value))} Kč`;
  return (
    <section className={s.food} aria-label={c.menus}>
      {!data ? (
        failed ? (
          <div className={s.empty}>
            <p role="alert">{c.menuError}</p>
            <button className={s.link} onClick={() => setAttempt((x) => x + 1)}>
              {c.retry}
            </button>{" "}
            <a href={MENU} target="_blank" rel="noopener noreferrer">
              {c.officialMenu} ↗
            </a>
          </div>
        ) : (
          <p role="status">{t.loading}</p>
        )
      ) : !data.configured ? (
        <div className={s.empty}>
          <h2>{c.menus}</h2>
          <p>{c.menuPending}</p>
          <a
            className={s.link}
            href={MENU}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.officialMenu} ↗
          </a>
        </div>
      ) : (
        <>
          <div className={s.foodControls}>
            <select
              aria-label={c.canteen}
              value={data.selected || ""}
              onChange={(e) => {
                setCanteen(e.target.value);
                try {
                  localStorage.setItem("kwf_canteen", e.target.value);
                } catch {}
              }}
            >
              {data.canteens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || `${c.canteen} ${p.id}`}
                </option>
              ))}
            </select>
            <span>
              {c.today} ·{" "}
              {DateTime.fromISO(data.date).setLocale(locale).toFormat("d. LLL")}
            </span>
            {data.canteens.find((p) => p.id === data.selected) && (
              <small className={s.muted}>
                {data.canteens.find((p) => p.id === data.selected)?.isOpen
                  ? c.open
                  : c.closed}
              </small>
            )}
          </div>
          {data.hours.length > 0 && (
            <details>
              <summary>{c.openingHours}</summary>
              {data.hours.map((h) => (
                <p key={h.id}>
                  {h.outletName || h.label} · {h.timeFrom || "—"}–
                  {h.timeTo || "—"}
                </p>
              ))}
            </details>
          )}
          {locale === "uk" && <p className={s.muted}>{c.ukMenu}</p>}
          {!data.meals.length && <p className={s.empty}>{c.noMeals}</p>}
          {data.categories
            .filter((category) =>
              data.meals.some((m) => m.categoryId === category.id),
            )
            .map((category) => (
              <section key={category.id}>
                <h2>{category.name}</h2>
                <div className={s.menuGrid}>
                  {data.meals
                    .filter((m) => m.categoryId === category.id)
                    .map((m) => (
                      <article className={s.meal} key={m.id}>
                        <div className={s.mealHeading}>
                          <div>
                            <small>{m.weight}</small>
                            <h3>{m.name || c.unavailable}</h3>
                          </div>
                          {m.hasPhoto && data.selected && (
                            <MealPhoto
                              key={`${data.date}:${data.selected}:${m.id}:${locale}`}
                              meal={m.id}
                              canteen={data.selected}
                              date={data.date}
                              name={m.name || c.unavailable}
                              locale={locale}
                            />
                          )}
                        </div>
                        <div className={s.prices}>
                          <span>
                            <small>{c.studentPrice}</small>
                            <br />
                            <strong>{money(m.studentPrice)}</strong>
                          </span>
                          <span>
                            <small>{c.regularPrice}</small>
                            <br />
                            {money(m.price)}
                          </span>
                        </div>
                        <details>
                          <summary>
                            {c.allergens}: {m.allergens.join(", ") || "—"}
                          </summary>
                          {m.allergens.map((id) => (
                            <p key={id}>
                              {id} ·{" "}
                              {data.allergens.find((a) => a.id === id)?.name ||
                                c.unavailable}
                            </p>
                          ))}
                        </details>
                      </article>
                    ))}
                </div>
              </section>
            ))}
          <footer>
            <a href={MENU} target="_blank" rel="noopener noreferrer">
              {c.foodSource} ↗
            </a>
            <span>
              {c.updated}:{" "}
              {DateTime.fromISO(data.updatedAt).setZone(ZONE).toFormat("HH:mm")}
            </span>
          </footer>
        </>
      )}
    </section>
  );
}
