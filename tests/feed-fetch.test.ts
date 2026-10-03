import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import {
  feedAddresses,
  feedUrl,
  fetchIcs,
  publicAddress,
} from "../src/server/feed-fetch";
import { MAX_ICS_BYTES } from "../src/server/ics";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});
describe("ICS download isolation", () => {
  it("times out slow bodies under the total request deadline", async () => {
    vi.useFakeTimers();
    vi.mocked(lookup).mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
    ] as never);
    vi.mocked(request).mockImplementation(((
      _url: unknown,
      options: { signal: AbortSignal },
    ) => {
      const req = Object.assign(new EventEmitter(), { end() {} });
      options.signal.addEventListener("abort", () =>
        req.emit("error", new Error("aborted")),
      );
      return req;
    }) as never);
    const assertion = expect(
      fetchIcs("https://public.example/feed"),
    ).rejects.toMatchObject({ code: "ics_unavailable" });
    await vi.advanceTimersByTimeAsync(10001);
    await assertion;
  });
  it("allows HTTPS/webcal subscriptions and blocks alternate protocols, credentials and ports", () => {
    expect(
      feedUrl("webcal://calendar.university.example/feed.ics").protocol,
    ).toBe("https:");
    for (const url of [
      "file:///etc/passwd",
      "http://public.example/feed",
      "ftp://public.example/feed",
      "https://u:p@public.example/feed",
      "https://public.example:3000/feed",
      "https://public.example/feed#token",
      "invalid",
    ]) {
      expect(() => feedUrl(url)).toThrow("ics_url");
    }
  });
  it("blocks private/special IPv4 and IPv6, mapped and encoded loopback, and mixed DNS answers", async () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.0.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "192.0.2.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "ff00::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
      "::2",
    ])
      expect(publicAddress(address), address).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
    for (const url of [
      "https://127.1/calendar",
      "https://2130706433/calendar",
      "https://[::1]/calendar",
    ])
      await expect(feedAddresses(feedUrl(url))).rejects.toMatchObject({
        code: "ics_url",
      });
    vi.mocked(lookup).mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ] as never);
    await expect(
      feedAddresses(feedUrl("https://public.example/feed")),
    ).rejects.toMatchObject({ code: "ics_url" });
  });
  function server(
    responses: {
      statusCode?: number;
      headers?: Record<string, string>;
      chunks?: Buffer[];
    }[],
  ) {
    vi.mocked(lookup).mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
    ] as never);
    vi.mocked(request).mockImplementation(((
      _url: unknown,
      options: { lookup: (...args: unknown[]) => void },
      callback: (response: unknown) => void,
    ) => {
      const req = new EventEmitter();
      Object.assign(req, {
        end() {
          const input = responses.shift()!;
          const response = Object.assign(new EventEmitter(), {
            statusCode: input.statusCode || 200,
            headers: input.headers || {},
            destroyed: false,
            destroy() {
              this.destroyed = true;
            },
          });
          callback(response);
          for (const chunk of input.chunks || [])
            if (!response.destroyed) response.emit("data", chunk);
          if (!response.destroyed) response.emit("end");
        },
      });
      options.lookup("public.example", {}, (_error: unknown, address: string) =>
        expect(address).toBe("8.8.8.8"),
      );
      return req;
    }) as never);
  }
  it("pins a validated DNS answer and bounds actual streamed bytes without trusting Content-Length", async () => {
    server([{ chunks: [Buffer.from("BEGIN:VCALENDAR")] }]);
    expect(await fetchIcs("https://public.example/feed")).toBe(
      "BEGIN:VCALENDAR",
    );
    server([{ chunks: [Buffer.alloc(MAX_ICS_BYTES), Buffer.alloc(1)] }]);
    await expect(fetchIcs("https://public.example/feed")).rejects.toMatchObject(
      { code: "ics_limit" },
    );
    server([{ headers: { "content-length": String(MAX_ICS_BYTES + 1) } }]);
    await expect(fetchIcs("https://public.example/feed")).rejects.toMatchObject(
      { code: "ics_limit" },
    );
    server([{ headers: { "content-encoding": "gzip" } }]);
    await expect(fetchIcs("https://public.example/feed")).rejects.toMatchObject(
      { code: "ics_unavailable" },
    );
  });
  it("revalidates redirects and refuses private destinations and redirect loops", async () => {
    server([
      { statusCode: 302, headers: { location: "https://127.0.0.1/private" } },
    ]);
    await expect(fetchIcs("https://public.example/feed")).rejects.toMatchObject(
      { code: "ics_url" },
    );
    expect(request).toHaveBeenCalledTimes(1);
    vi.mocked(request).mockClear();
    server(
      Array.from({ length: 4 }, () => ({
        statusCode: 302,
        headers: { location: "/loop" },
      })),
    );
    await expect(fetchIcs("https://public.example/feed")).rejects.toMatchObject(
      { code: "ics_unavailable" },
    );
    expect(request).toHaveBeenCalledTimes(4);
  });
});
