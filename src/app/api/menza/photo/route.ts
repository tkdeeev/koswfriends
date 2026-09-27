import { z } from "zod";
import { NextResponse } from "next/server";
import { endpoint, session, NO_STORE } from "@/server/http";
import { menzaPhoto } from "@/server/menza";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  await session(req);
  const positive = z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER);
  const meal = positive.parse(req.nextUrl.searchParams.get("meal"));
  const canteen = positive.parse(req.nextUrl.searchParams.get("canteen"));
  const lang = z
    .enum(["cs", "en", "uk"])
    .parse(req.nextUrl.searchParams.get("lang") || "cs");
  const image = await menzaPhoto(canteen, meal, lang === "cs" ? "cs" : "en");
  return new NextResponse(new Uint8Array(image), {
    headers: {
      ...NO_STORE,
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
});
