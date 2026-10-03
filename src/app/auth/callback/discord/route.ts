import { endpoint } from "@/server/http";
import { externalCallback } from "@/server/external-auth";
export const dynamic = "force-dynamic";
export const GET = endpoint((req) => externalCallback(req, "discord"));
