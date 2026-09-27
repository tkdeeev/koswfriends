import { DateTime } from "luxon";
import { z } from "zod";
import sharp from "sharp";
import { ZONE } from "../lib/calendar";
import { AppError } from "./security";

const BASE = "https://agata.suz.cvut.cz/jidelnicky/JAPIV3/api/v3";
const id = z.number().int().positive();
const text = z.string().max(10000);
const nullable = text.nullable();
const price = z
  .string()
  .regex(/^\d+\.\d{2}$/)
  .nullable();
const canteen = z.object({
  id,
  name: nullable,
  isOpen: z.boolean(),
  dailyMenuEnabled: z.boolean(),
  weeklyMenuEnabled: z.boolean(),
  sortOrder: z.number(),
});
const meal = z.object({
  id,
  podsystemId: id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: id,
  outletIds: z.array(id),
  name: nullable,
  weight: nullable,
  studentPrice: price,
  price,
  currency: z.literal("CZK"),
  allergens: z.array(z.number().int().min(1).max(14)),
  isActive: z.boolean(),
  photoId: id.nullish(),
});
const category = z.object({ id, name: text, sortOrder: z.number() });
const allergen = z.object({ id, name: text, description: text });
const hour = z.object({
  id,
  outletName: nullable,
  label: nullable,
  dayFrom: z.number().int().min(1).max(7).nullable(),
  dayTo: z.number().int().min(1).max(7).nullable(),
  timeFrom: nullable,
  timeTo: nullable,
  sortOrder: z.number(),
});
type Entry = {
  data?: unknown;
  etag?: string;
  expires: number;
  retryAt: number;
  failures: number;
  pending?: Promise<unknown>;
};
const cache = new Map<string, Entry>();
const photos = new Map<string, Entry>();
let credential = "";
let globalRetryAt = 0;

function apiKey() {
  const key = process.env.MENZA_API_KEY || "";
  if (!key) throw new AppError("menza_unconfigured", 503);
  if (credential !== key) {
    cache.clear();
    photos.clear();
    globalRetryAt = 0;
    credential = key;
  }
  return key;
}
function observeRetry(response: Response) {
  if (response.status !== 429 && response.status !== 503) return;
  const header = response.headers.get("retry-after");
  const retryAt = header
    ? /^\d+$/.test(header)
      ? Date.now() + Number(header) * 1000
      : Date.parse(header)
    : 0;
  globalRetryAt = Math.max(
    globalRetryAt,
    Number.isFinite(retryAt) ? retryAt : 0,
  );
}
function backoff(entry: Entry) {
  entry.failures++;
  entry.retryAt =
    Date.now() +
    Math.min(15 * 60000, 30000 * 2 ** Math.min(entry.failures - 1, 5)) +
    Math.floor(Math.random() * 5000);
}

async function read<T>(
  path: string,
  lang: "cs" | "en",
  schema: z.ZodType<T>,
  day: string,
): Promise<T> {
  const key = apiKey();
  const cacheKey = `${day}:${lang}:${path}`;
  let entry = cache.get(cacheKey);
  if (!entry) {
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    entry = { expires: 0, retryAt: 0, failures: 0 };
    cache.set(cacheKey, entry);
  }
  if (entry.expires > Date.now() && entry.data !== undefined)
    return schema.parse(entry.data);
  if (Math.max(entry.retryAt, globalRetryAt) > Date.now())
    throw new AppError("menza_unavailable", 503);
  if (entry.pending) return schema.parse(await entry.pending);
  const current = entry;
  current.pending = (async () => {
    try {
      const r = await fetch(`${BASE}${path}?lang=${lang}`, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          Accept: "application/json",
          "X-API-Key": key,
          ...(current.etag ? { "If-None-Match": current.etag } : {}),
        },
      });
      observeRetry(r);
      let data: T;
      if (r.status === 304 && current.data !== undefined)
        data = schema.parse(current.data);
      else {
        if (!r.ok || Number(r.headers.get("content-length")) > 2_000_000)
          throw new Error();
        const body = await r.text();
        if (body.length > 2_000_000) throw new Error();
        data = schema.parse(JSON.parse(body).data);
      }
      current.data = data;
      current.etag = r.headers.get("etag") || current.etag;
      current.expires = Date.now() + 5 * 60000;
      current.failures = 0;
      current.retryAt = 0;
      return data;
    } catch {
      backoff(current);
      throw new AppError("menza_unavailable", 503);
    } finally {
      current.pending = undefined;
    }
  })();
  return schema.parse(await current.pending);
}

export async function menzaMenu(lang: "cs" | "en", requested?: number) {
  const today = DateTime.now().setZone(ZONE);
  const date = today.toISODate()!;
  if (!process.env.MENZA_API_KEY) return { configured: false as const, date };
  const canteens = (
    await read("/podsystems", lang, z.array(canteen).max(100), date)
  ).sort((a, b) => a.sortOrder - b.sortOrder);
  const selected = requested
    ? canteens.find((c) => c.id === requested)
    : canteens.find((c) => c.dailyMenuEnabled) || canteens[0];
  if (requested && !selected) throw new AppError("not_found", 404);
  if (!selected)
    return {
      configured: true as const,
      date,
      canteens,
      selected: null,
      meals: [],
      categories: [],
      allergens: [],
      hours: [],
      updatedAt: new Date().toISOString(),
    };
  const [meals, categories, allergens, hours] = await Promise.all([
    selected.dailyMenuEnabled
      ? read(
          `/podsystems/${selected.id}/meals`,
          lang,
          z.array(meal).max(1000),
          date,
        )
      : Promise.resolve([]),
    read(
      `/podsystems/${selected.id}/categories`,
      lang,
      z.array(category).max(100),
      date,
    ),
    read("/allergens", lang, z.array(allergen).max(14), date),
    read(
      `/podsystems/${selected.id}/opening-hours`,
      lang,
      z.array(hour).max(200),
      date,
    ),
  ]);
  return {
    configured: true as const,
    date,
    canteens,
    selected: selected.id,
    meals: meals
      .filter(
        (m) => m.isActive && m.date === date && m.podsystemId === selected.id,
      )
      .map(({ photoId, ...m }) => ({ ...m, hasPhoto: photoId != null })),
    categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
    allergens,
    hours: hours
      .filter(
        (h) =>
          h.dayFrom != null &&
          h.dayTo != null &&
          (h.dayFrom <= h.dayTo
            ? today.weekday >= h.dayFrom && today.weekday <= h.dayTo
            : today.weekday >= h.dayFrom || today.weekday <= h.dayTo),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder),
    updatedAt: new Date().toISOString(),
  };
}
export type MenzaMenu = Awaited<ReturnType<typeof menzaMenu>>;

/** Only today's known meal IDs can be proxied. Never follow a provider-supplied URL. */
export async function menzaPhoto(
  canteenId: number,
  mealId: number,
  lang: "cs" | "en",
) {
  const key = apiKey();
  const menu = await menzaMenu(lang, canteenId);
  if (
    !menu.configured ||
    !menu.meals.some((m) => m.id === mealId && m.hasPhoto)
  )
    throw new AppError("not_found", 404);
  const cacheKey = `${menu.date}:${canteenId}:${mealId}:${lang}`;
  let entry = photos.get(cacheKey);
  if (!entry) {
    // At most 32 re-encoded images, each capped at 1.5 MB.
    if (photos.size >= 32) photos.delete(photos.keys().next().value!);
    entry = { expires: 0, retryAt: 0, failures: 0 };
    photos.set(cacheKey, entry);
  }
  if (entry.expires > Date.now() && Buffer.isBuffer(entry.data))
    return entry.data;
  if (Math.max(entry.retryAt, globalRetryAt) > Date.now())
    throw new AppError("menza_unavailable", 503);
  if (entry.pending) return (await entry.pending) as Buffer;
  const current = entry;
  current.pending = (async () => {
    try {
      const response = await fetch(
        `${BASE}/meals/${mealId}/photo?lang=${lang}`,
        {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: {
            "X-API-Key": key,
            Accept: "image/jpeg,image/png,image/webp",
            ...(current.etag ? { "If-None-Match": current.etag } : {}),
          },
        },
      );
      observeRetry(response);
      let image: Buffer;
      if (response.status === 304 && Buffer.isBuffer(current.data))
        image = current.data;
      else {
        if (response.status === 404) throw new AppError("not_found", 404);
        if (!response.ok) throw new Error();
        image = await normalizeMealPhoto(response);
      }
      current.data = image;
      current.etag = response.headers.get("etag") || current.etag;
      current.expires = Date.now() + 5 * 60000;
      current.failures = 0;
      current.retryAt = 0;
      return image;
    } catch (error) {
      backoff(current);
      if (error instanceof AppError && error.code === "not_found") throw error;
      throw new AppError("menza_unavailable", 503);
    } finally {
      current.pending = undefined;
    }
  })();
  return (await current.pending) as Buffer;
}

async function normalizeMealPhoto(response: Response) {
  const limit = 8 * 1024 * 1024;
  if (!response.body || Number(response.headers.get("content-length")) > limit)
    throw new Error();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const input = Buffer.concat(chunks);
  const raster =
    input.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    input
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (input.toString("ascii", 0, 4) === "RIFF" &&
      input.toString("ascii", 8, 12) === "WEBP");
  if (!raster) throw new Error();
  const image = sharp(input, {
    limitInputPixels: 50_000_000,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format || "") ||
    (metadata.pages || 1) > 1
  )
    throw new Error();
  const result = await image
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .timeout({ seconds: 10 })
    .toBuffer();
  if (result.byteLength > 1_500_000) throw new Error();
  return result;
}
