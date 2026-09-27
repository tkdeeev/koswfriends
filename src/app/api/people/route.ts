import { z } from "zod";
import { endpoint, session, json } from "@/server/http";
import { AppError } from "@/server/security";
import { peopleOverview } from "@/server/people";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const raw = req.nextUrl.searchParams.get("id");
  const id = raw ? z.uuid().parse(raw) : undefined;
  const people = await peopleOverview(user.id, id);
  if (id && !people.length) throw new AppError("not_found", 404);
  return json({ people });
});
