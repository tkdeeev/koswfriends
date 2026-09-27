import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { NextResponse } from "next/server";
import { database } from "@/server/db";
import { profilePictures } from "@/server/schema";
import { endpoint, session, NO_STORE } from "@/server/http";
import { related, isBlocked } from "@/server/sharing";
import { AppError } from "@/server/security";

export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const id = z.uuid().parse(req.nextUrl.searchParams.get("id"));
  const [picture] = await database()
    .select({ image: profilePictures.image })
    .from(profilePictures)
    .where(
      and(
        eq(profilePictures.userId, id),
        sql`(${id} = ${user.id} or (${related(id, user.id)} and not ${isBlocked(id, user.id)}))`,
      ),
    );
  if (!picture) throw new AppError("not_found", 404);
  return new NextResponse(
    new Uint8Array(Buffer.from(picture.image, "base64")),
    {
      headers: {
        ...NO_STORE,
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    },
  );
});
