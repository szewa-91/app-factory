import { describe, expect, it, vi } from "vitest";
import { checkResources, getResourceUsage } from "../resources.js";

function createMockReader(statSamples: string[], meminfo: string): (filePath: string) => Promise<string> {
  let statIndex = 0;

  return async (filePath: string): Promise<string> => {
    if (filePath.endsWith("/stat")) {
      const index = Math.min(statIndex, statSamples.length - 1);
      statIndex += 1;
      return statSamples[index] ?? statSamples[statSamples.length - 1] ?? "";
    }

    if (filePath.endsWith("/meminfo")) {
      return meminfo;
    }

    throw new Error(`Unexpected path: ${filePath}`);
  };
}

describe("resource usage", () => {
  it("calculates CPU and RAM percentages from /proc data", async () => {
    const readTextFile = createMockReader(
      ["cpu 100 0 100 100 0 0 0 0 0 0\n", "cpu 150 0 150 120 0 0 0 0 0 0\n"],
      "MemTotal: 1000 kB\nMemAvailable: 200 kB\n"
    );

    const usage = await getResourceUsage({
      procRoot: "/proc",
      sampleDelayMs: 0,
      readTextFile,
      sleep: async () => {}
    });

    expect(usage.cpu).toBeCloseTo(83.33, 2);
    expect(usage.ram).toBeCloseTo(80, 2);
  });

  it("marks skip=true when either CPU or RAM exceeds threshold", async () => {
    const readTextFile = createMockReader(
      ["cpu 100 0 100 100 0 0 0 0 0 0\n", "cpu 150 0 150 120 0 0 0 0 0 0\n"],
      "MemTotal: 1000 kB\nMemAvailable: 900 kB\n"
    );

    const result = await checkResources(80, {
      procRoot: "/proc",
      sampleDelayMs: 0,
      readTextFile,
      sleep: async () => {}
    });

    expect(result.skip).toBe(true);
    expect(result.cpu).toBeGreaterThan(80);
    expect(result.ram).toBeLessThanOrEqual(80);
  });

  it("falls back to 0 when /proc parsing fails", async () => {
    const readTextFile = vi.fn(async () => "bad-data");

    const result = await checkResources(80, {
      procRoot: "/proc",
      sampleDelayMs: 0,
      readTextFile,
      sleep: async () => {}
    });

    expect(result.cpu).toBe(0);
    expect(result.ram).toBe(0);
    expect(result.skip).toBe(false);
  });
});
