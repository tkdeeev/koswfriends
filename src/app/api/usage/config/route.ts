import { analyticsConfiguration } from "@/server/analytics";

export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    { enabled: !!analyticsConfiguration() },
    {
      headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store" },
    },
  );
}
