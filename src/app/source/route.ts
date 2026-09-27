export const dynamic = "force-dynamic";

export function GET() {
  const revision = process.env.APP_REVISION || "";
  const ref = /^[a-f0-9]{40}$/i.test(revision) ? revision : "main";
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/tkdeeev/koswfriends/tree/${ref}`,
      "Cache-Control": "no-store",
    },
  });
}
