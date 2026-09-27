import { afterEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { menzaMenu, menzaPhoto } from "../src/server/menza";
import sharp from "sharp";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const canteen = {
  id: 1,
  name: "Synthetic canteen",
  isOpen: false,
  dailyMenuEnabled: true,
  weeklyMenuEnabled: false,
  sortOrder: 0,
};
const date = DateTime.now().setZone("Europe/Prague").toISODate();
const meal = {
  id: 12,
  podsystemId: 1,
  date,
  categoryId: 1,
  outletIds: [1],
  name: "Synthetic meal",
  weight: "200 g",
  studentPrice: "0.00",
  price: null,
  currency: "CZK",
  allergens: [1, 3],
  isActive: true,
  photoId: 9,
  photoUrl: "https://untrusted.invalid/image",
};
describe("official menza adapter", () => {
  function photoProvider(
    photo: () => Promise<Response>,
    source: Omit<typeof meal, "photoId"> & { photoId: number | null } = meal,
  ) {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).not.toContain("untrusted.invalid");
      expect(init.redirect).toBe("error");
      if (url.includes("/photo?")) {
        expect(url).toContain("/meals/12/photo?lang=en");
        expect(init.headers).toHaveProperty(
          "X-API-Key",
          process.env.MENZA_API_KEY,
        );
        return photo();
      }
      return Response.json({
        data: url.includes("/meals?")
          ? [source]
          : url.includes("/podsystems?")
            ? [canteen]
            : [],
      });
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }
  it("proxies only today's known photos, strips metadata and caches the converted image", async () => {
    vi.stubEnv("MENZA_API_KEY", "synthetic-photo-key");
    const original = await sharp({
      create: { width: 1600, height: 800, channels: 3, background: "#507e62" },
    })
      .jpeg()
      .withExif({ IFD0: { Artist: "provider-camera-metadata" } })
      .toBuffer();
    const fetch = photoProvider(
      async () =>
        new Response(new Uint8Array(original), {
          headers: { "Content-Type": "image/jpeg", ETag: '"photo"' },
        }),
    );
    const image = await menzaPhoto(1, 12, "en");
    expect(await sharp(image).metadata()).toMatchObject({
      format: "webp",
      width: 1200,
      height: 600,
    });
    expect((await sharp(image).metadata()).exif).toBeUndefined();
    expect(await menzaPhoto(1, 12, "en")).toEqual(image);
    await expect(menzaPhoto(1, 999, "en")).rejects.toMatchObject({
      code: "not_found",
    });
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it("does not attempt images when the menu says there is no photo", async () => {
    vi.stubEnv("MENZA_API_KEY", "synthetic-no-photo-key");
    const fetch = photoProvider(
      async () => {
        throw new Error("Must not fetch");
      },
      { ...meal, photoId: null },
    );
    await expect(menzaPhoto(1, 12, "en")).rejects.toMatchObject({
      code: "not_found",
    });
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("rejects non-raster payloads and bounds photo streams even without Content-Length", async () => {
    for (const [index, response] of [
      new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
        headers: { "Content-Type": "image/jpeg" },
      }),
      new Response(
        new ReadableStream({
          start(controller) {
            for (let i = 0; i < 3; i++)
              controller.enqueue(new Uint8Array(3 * 1024 * 1024));
            controller.close();
          },
        }),
      ),
    ].entries()) {
      vi.stubEnv("MENZA_API_KEY", `synthetic-bad-photo-${index}`);
      photoProvider(async () => response);
      await expect(menzaPhoto(1, 12, "en")).rejects.toMatchObject({
        code: "menza_unavailable",
      });
    }
  });
  it("backs off on photo throttling instead of retrying for every image render", async () => {
    vi.stubEnv("MENZA_API_KEY", "synthetic-photo-rate-limit");
    const fetch = photoProvider(
      async () =>
        new Response(null, { status: 429, headers: { "Retry-After": "120" } }),
    );
    await expect(menzaPhoto(1, 12, "en")).rejects.toThrow("menza_unavailable");
    await expect(menzaPhoto(1, 12, "en")).rejects.toThrow("menza_unavailable");
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it("does not call the provider without a key", async () => {
    vi.stubEnv("MENZA_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await menzaMenu("cs")).toEqual({ configured: false, date });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps keys server-side, caches responses, preserves zero/null prices, and hides stale meals", async () => {
    vi.stubEnv("MENZA_API_KEY", "synthetic-key-cache");
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      expect(
        url.startsWith("https://agata.suz.cvut.cz/jidelnicky/JAPIV3/api/v3/"),
      ).toBe(true);
      expect(url).not.toContain("synthetic-key");
      expect(url).toContain("lang=en");
      expect(init.headers).toHaveProperty("X-API-Key", "synthetic-key-cache");
      expect(init.redirect).toBe("error");
      const data = url.includes("/meals?")
        ? [meal, { ...meal, id: 13, date: "2000-01-01" }]
        : url.includes("/podsystems?")
          ? [canteen]
          : [];
      return Response.json({ data }, { headers: { ETag: '"test"' } });
    });
    vi.stubGlobal("fetch", fetch);
    const first = await menzaMenu("en", 1);
    await menzaMenu("en", 1);
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(first.configured && first.meals).toEqual([
      expect.objectContaining({ id: 12, price: null, studentPrice: "0.00" }),
    ]);
    expect(JSON.stringify(first)).not.toContain("photoUrl");
    expect(JSON.stringify(first)).not.toContain("synthetic-key");
  });
  it("respects Retry-After across requests without hammering the provider", async () => {
    vi.stubEnv("MENZA_API_KEY", "synthetic-key-limits");
    const fetch = vi.fn(
      async () =>
        new Response(null, { status: 429, headers: { "Retry-After": "120" } }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(menzaMenu("cs")).rejects.toThrow("menza_unavailable");
    await expect(menzaMenu("en")).rejects.toThrow("menza_unavailable");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
