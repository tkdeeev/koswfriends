import { endpoint, json, session } from "@/server/http";
import { synchronize } from "@/server/sync";
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const result = await synchronize(user.id, user.semester, true);
  return json(result || { ok: true });
});
