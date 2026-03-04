import { readFile } from "node:fs/promises";

const DEFAULT_PROC_ROOT = "/proc";
export const RESOURCE_THRESHOLD = 80;

interface CpuSample {
  total: number;
  idle: number;
}

type ReadTextFile = (filePath: string) => Promise<string>;
type SleepFn = (ms: number) => Promise<void>;

export interface ResourceUsage {
  cpu: number;
  ram: number;
}

export interface ResourceCheckResult extends ResourceUsage {
  skip: boolean;
}

export interface ResourceOptions {
  procRoot?: string;
  sampleDelayMs?: number;
  readTextFile?: ReadTextFile;
  sleep?: SleepFn;
}

const defaultSleep: SleepFn = async (ms) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseStatField(parts: string[], index: number): number {
  const raw = parts[index];
  if (raw === undefined) {
    throw new Error("Missing numeric field in /proc/stat cpu line");
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error("Non-numeric value in /proc/stat cpu line");
  }

  return parsed;
}

function parseCpuSample(procStat: string): CpuSample {
  const [firstLine] = procStat.split("\n");
  if (!firstLine) {
    throw new Error("Missing cpu line in /proc/stat");
  }

  const parts = firstLine.trim().split(/\s+/);
  if (parts.length < 9 || parts[0] !== "cpu") {
    throw new Error("Invalid cpu line in /proc/stat");
  }

  const user = parseStatField(parts, 1);
  const nice = parseStatField(parts, 2);
  const system = parseStatField(parts, 3);
  const idle = parseStatField(parts, 4);
  const iowait = parseStatField(parts, 5);
  const irq = parseStatField(parts, 6);
  const softirq = parseStatField(parts, 7);
  const steal = parseStatField(parts, 8);

  const total = user + nice + system + idle + iowait + irq + softirq + steal;
  return { total, idle: idle + iowait };
}

function computeCpuUsage(first: CpuSample, second: CpuSample): number {
  const totalDelta = second.total - first.total;
  const idleDelta = second.idle - first.idle;
  if (totalDelta <= 0) {
    return 0;
  }

  return roundToTwo((1 - idleDelta / totalDelta) * 100);
}

function parseRamUsage(meminfo: string): number {
  let memTotal = 0;
  let memAvailable = 0;

  for (const line of meminfo.split("\n")) {
    if (line.startsWith("MemTotal:")) {
      memTotal = Number.parseInt(line.replace(/[^0-9]/g, ""), 10);
      continue;
    }

    if (line.startsWith("MemAvailable:")) {
      memAvailable = Number.parseInt(line.replace(/[^0-9]/g, ""), 10);
    }
  }

  if (!Number.isFinite(memTotal) || memTotal <= 0 || !Number.isFinite(memAvailable) || memAvailable < 0) {
    return 0;
  }

  return roundToTwo(((memTotal - memAvailable) / memTotal) * 100);
}

async function readCpuUsage(options: Required<Pick<ResourceOptions, "procRoot" | "sampleDelayMs" | "readTextFile" | "sleep">>): Promise<number> {
  const statPath = `${options.procRoot}/stat`;
  const firstSample = parseCpuSample(await options.readTextFile(statPath));
  await options.sleep(options.sampleDelayMs);
  const secondSample = parseCpuSample(await options.readTextFile(statPath));

  return computeCpuUsage(firstSample, secondSample);
}

async function readRamUsage(options: Required<Pick<ResourceOptions, "procRoot" | "readTextFile">>): Promise<number> {
  const meminfoPath = `${options.procRoot}/meminfo`;
  const meminfo = await options.readTextFile(meminfoPath);
  return parseRamUsage(meminfo);
}

export async function getResourceUsage(options: ResourceOptions = {}): Promise<ResourceUsage> {
  const procRoot = options.procRoot ?? DEFAULT_PROC_ROOT;
  const sampleDelayMs = options.sampleDelayMs ?? 200;
  const readTextFile = options.readTextFile ?? ((filePath: string) => readFile(filePath, "utf8"));
  const sleep = options.sleep ?? defaultSleep;

  let cpu = 0;
  let ram = 0;

  try {
    cpu = await readCpuUsage({ procRoot, sampleDelayMs, readTextFile, sleep });
  } catch {
    cpu = 0;
  }

  try {
    ram = await readRamUsage({ procRoot, readTextFile });
  } catch {
    ram = 0;
  }

  return { cpu, ram };
}

export async function checkResources(threshold: number = RESOURCE_THRESHOLD, options: ResourceOptions = {}): Promise<ResourceCheckResult> {
  const usage = await getResourceUsage(options);
  return {
    ...usage,
    skip: usage.cpu > threshold || usage.ram > threshold
  };
}
