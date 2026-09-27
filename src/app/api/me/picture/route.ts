import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { database } from "@/server/db";
import { users, profilePictures } from "@/server/schema";
import { endpoint, json, session } from "@/server/http";
import { readPicture, normalizePicture } from "@/server/profile-picture";

export const dynamic = "force-dynamic";
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const image = await normalizePicture(await readPicture(req));
  const avatarVersion = randomUUID();
  await database().transaction(async (tx) => {
    // Serialize upload/remove and let user deletion cascade to the image.
    await tx.update(users).set({ avatarVersion }).where(eq(users.id, user.id));
    await tx
      .insert(profilePictures)
      .values({ userId: user.id, image: image.toString("base64") })
      .onConflictDoUpdate({
        target: profilePictures.userId,
        set: { image: image.toString("base64") },
      });
  });
  return json({ ok: true, avatarVersion });
});

export const DELETE = endpoint(async (req) => {
  const { user } = await session(req, true);
  await database().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ avatarVersion: null })
      .where(eq(users.id, user.id));
    await tx.delete(profilePictures).where(eq(profilePictures.userId, user.id));
  });
  return json({ ok: true, avatarVersion: null });
});
