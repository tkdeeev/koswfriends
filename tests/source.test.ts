import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../src/app/source/route";

afterEach(() => vi.unstubAllEnvs());

it("offers the deployed source revision without caching it across releases", () => {
  const revision = "0123456789abcdef0123456789abcdef01234567";
  vi.stubEnv("APP_REVISION", revision);
  const response = GET();
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    `https://github.com/tkdeeev/koswfriends/tree/${revision}`,
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("keeps development and invalid revisions on the fixed public repository", () => {
  for (const revision of [
    "",
    "development",
    "../../other-repo",
    "https://example.test/",
  ]) {
    vi.stubEnv("APP_REVISION", revision);
    expect(GET().headers.get("location")).toBe(
      "https://github.com/tkdeeev/koswfriends/tree/main",
    );
  }
});
