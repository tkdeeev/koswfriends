import { afterEach, expect, it, vi } from "vitest";
import { Worker } from "node:worker_threads";
import { parseIcs } from "../src/server/ics";
import { semesterWindow } from "../src/lib/calendar";
vi.mock("node:worker_threads", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    Worker: vi.fn(
      class extends EventEmitter {
        terminate = vi.fn(async () => 1);
      },
    ),
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("terminates stuck parsers after five seconds without exposing input", async () => {
  vi.useFakeTimers();
  const assertion = expect(
    parseIcs("private-calendar-input", semesterWindow("B261")),
  ).rejects.toMatchObject({ code: "ics_limit", message: "ics_limit" });
  const worker = vi.mocked(Worker).mock.results[0].value as Worker;
  await vi.advanceTimersByTimeAsync(5001);
  await assertion;
  expect(worker.terminate).toHaveBeenCalled();
});
it("contains a parser memory failure and terminates its worker", async () => {
  const assertion = expect(
    parseIcs("private-calendar-input", semesterWindow("B261")),
  ).rejects.toMatchObject({ code: "ics_limit", message: "ics_limit" });
  const worker = vi.mocked(Worker).mock.results[0].value as Worker;
  worker.emit(
    "error",
    new Error("worker out of memory with private-calendar-input"),
  );
  await assertion;
  expect(worker.terminate).toHaveBeenCalled();
});
