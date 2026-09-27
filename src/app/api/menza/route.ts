import { z } from "zod";
import { endpoint, session, json } from "@/server/http";
import { menzaMenu } from "@/server/menza";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  await session(req);
  const lang = z
    .enum(["cs", "en", "uk"])
    .parse(req.nextUrl.searchParams.get("lang") || "cs");
  const raw = req.nextUrl.searchParams.get("canteen");
  const id = raw
    ? z.coerce.number().int().positive().max(100000).parse(raw)
    : undefined;
  return json(await menzaMenu(lang === "cs" ? "cs" : "en", id));
});
