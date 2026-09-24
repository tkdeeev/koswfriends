import { z } from "zod";
import { eq } from "drizzle-orm";
import { config } from "./config";
import { database } from "./db";
import { connections, users } from "./schema";
import { AppError, decrypt, encrypt } from "./security";
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  token_type: z.string().optional(),
});
export async function providerJson(url: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError("provider_unavailable", 503);
  }
  if (!response.ok)
    throw new AppError(
      response.status === 401 ||
        response.status === 403 ||
        response.status === 400
        ? "provider_denied"
        : "provider_unavailable",
      502,
    );
  try {
    return await response.json();
  } catch {
    throw new AppError("provider_format", 502);
  }
}
export async function validateToken(access: string) {
  const cfg = config();
  const data = await providerJson(cfg.checkUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: access }),
  });
  const scopes = Array.isArray(data.scope)
    ? data.scope
    : typeof data.scope === "string"
      ? data.scope.split(/\s+/)
      : [];
  if (
    data.client_id !== cfg.clientId ||
    typeof data.user_name !== "string" ||
    !/^[a-zA-Z0-9._-]{1,80}$/.test(data.user_name) ||
    typeof data.exp !== "number" ||
    data.exp * 1000 <= Date.now() ||
    !scopes.includes(cfg.scope)
  )
    throw new AppError("invalid_identity", 502);
  return {
    username: data.user_name.toLowerCase(),
    expiresAt: new Date(data.exp * 1000),
  };
}
export async function exchangeToken(params: Record<string, string>) {
  const cfg = config();
  const data = await providerJson(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(params),
  });
  const parsed = tokenSchema.safeParse(data);
  if (
    !parsed.success ||
    (parsed.data.token_type &&
      parsed.data.token_type.toLowerCase() !== "bearer")
  )
    throw new AppError("provider_format", 502);
  return { ...parsed.data, ...(await validateToken(parsed.data.access_token)) };
}
/** Row lock spans token refresh, serializing rotations across web and worker processes. */
export async function accessToken(userId: string) {
  const result = await database().transaction(async (tx) => {
    const [connection] = await tx
      .select()
      .from(connections)
      .where(eq(connections.userId, userId))
      .for("update");
    if (!connection || connection.reconnect) return { error: "reconnect" };
    if (connection.expiresAt.getTime() > Date.now() + 60000)
      return { token: decrypt(connection.access) };
    if (!connection.refresh) {
      await tx
        .update(connections)
        .set({ reconnect: true })
        .where(eq(connections.userId, userId));
      return { error: "reconnect" };
    }
    try {
      const refreshed = await exchangeToken({
        grant_type: "refresh_token",
        refresh_token: decrypt(connection.refresh),
      });
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user || user.username !== refreshed.username)
        throw new AppError("invalid_identity", 502);
      await tx
        .update(connections)
        .set({
          access: encrypt(refreshed.access_token),
          refresh: encrypt(
            refreshed.refresh_token || decrypt(connection.refresh),
          ),
          expiresAt: refreshed.expiresAt,
        })
        .where(eq(connections.userId, userId));
      return { token: refreshed.access_token };
    } catch (e) {
      if (
        e instanceof AppError &&
        ["provider_denied", "invalid_identity"].includes(e.code)
      ) {
        await tx
          .update(connections)
          .set({ reconnect: true })
          .where(eq(connections.userId, userId));
        return { error: "reconnect" };
      }
      return { error: "provider_unavailable" };
    }
  });
  if (!result.token) throw new AppError(result.error || "reconnect", 503);
  return result.token;
}
