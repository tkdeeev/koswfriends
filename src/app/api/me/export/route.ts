import { exportAccount } from "@/server/export";
import { endpoint, json, session } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const data = await exportAccount(user.id);
  const response = json(data);
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="koswfriends-data-${data.exportedAt.slice(0, 10)}.json"`,
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
});
