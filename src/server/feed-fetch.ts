import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { AppError } from "./security";
import { MAX_ICS_BYTES } from "./ics";

export function feedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.replace(/^webcal:/i, "https:"));
  } catch {
    throw new AppError("ics_url");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !url.hostname ||
    value.length > 2048
  )
    throw new AppError("ics_url");
  return url;
}
export function publicAddress(address: string) {
  try {
    const parsed = ipaddr.parse(address);
    // Reject private, loopback, link-local, multicast, mapped IPv4 and special ranges.
    return (
      parsed.range() === "unicast" &&
      (parsed.kind() === "ipv4" || parsed.match(ipaddr.parse("2000::"), 3))
    );
  } catch {
    return false;
  }
}
export async function feedAddresses(url: URL) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((item) => !publicAddress(item.address))
  )
    throw new AppError("ics_url");
  return addresses;
}
export async function fetchIcs(value: string): Promise<string> {
  // One deadline covers DNS, redirects, headers and the entire response body.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let url = feedUrl(value);
    for (let redirect = 0; redirect <= 3; redirect++) {
      const addresses = await Promise.race([
        feedAddresses(url),
        new Promise<never>((_, reject) => {
          if (controller.signal.aborted)
            reject(new AppError("ics_unavailable", 502));
          else
            controller.signal.addEventListener(
              "abort",
              () => reject(new AppError("ics_unavailable", 502)),
              { once: true },
            );
        }),
      ]);
      const result = await new Promise<{ text?: string; location?: string }>(
        (resolve, reject) => {
          const address = addresses[0];
          const req = request(
            url,
            {
              signal: controller.signal,
              family: address.family,
              // Pin the validated DNS answer; never resolve again at connect time.
              lookup: (_host, _options, callback) =>
                callback(null, address.address, address.family),
              headers: {
                Accept: "text/calendar, text/plain;q=0.9",
                "Accept-Encoding": "identity",
                "User-Agent": "KOSwFriends calendar subscription",
              },
            },
            (response) => {
              response.on("error", reject);
              if (
                [301, 302, 303, 307, 308].includes(response.statusCode || 0)
              ) {
                const location = response.headers.location;
                response.destroy();
                if (!location) reject(new AppError("ics_unavailable", 502));
                else resolve({ location });
                return;
              }
              if (
                response.statusCode !== 200 ||
                (response.headers["content-encoding"] &&
                  response.headers["content-encoding"] !== "identity")
              ) {
                response.destroy();
                reject(new AppError("ics_unavailable", 502));
                return;
              }
              let size = 0;
              const chunks: Buffer[] = [];
              const fail = () => {
                response.destroy();
                reject(new AppError("ics_limit"));
              };
              if (Number(response.headers["content-length"]) > MAX_ICS_BYTES) {
                fail();
                return;
              }
              response.on("data", (chunk: Buffer) => {
                size += chunk.length;
                if (size > MAX_ICS_BYTES) fail();
                else chunks.push(chunk);
              });
              response.on("end", () =>
                resolve({ text: Buffer.concat(chunks).toString("utf8") }),
              );
            },
          );
          req.on("error", reject);
          req.end();
        },
      );
      if (result.text !== undefined) return result.text;
      url = feedUrl(new URL(result.location!, url).toString());
    }
    throw new AppError("ics_unavailable", 502);
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError("ics_unavailable", 502);
  } finally {
    clearTimeout(timeout);
  }
}
