import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

const DEFAULT_WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? "/home/szewa/app-factory";
const LESSONS_DIR_NAME = "lessons";
const MAX_LESSONS = 5;
const MAX_PREVIEW_CHARS = 200;

interface LessonPreview {
  fileName: string;
  modifiedAt: number;
  preview: string;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return value.slice(0, maxChars);
}

function normalizeLessonContent(content: string): string {
  return content.replace(/\n/g, " ");
}

async function buildLessonPreview(lessonsDir: string, fileName: string): Promise<LessonPreview | null> {
  const absolutePath = join(lessonsDir, fileName);

  try {
    const fileStats = await stat(absolutePath);
    if (!fileStats.isFile()) {
      return null;
    }

    const rawContent = await readFile(absolutePath, "utf8");
    return {
      fileName: basename(fileName),
      modifiedAt: fileStats.mtimeMs,
      preview: truncate(normalizeLessonContent(rawContent), MAX_PREVIEW_CHARS)
    };
  } catch {
    return null;
  }
}

export async function readSharedKnowledge(workspaceDir: string = DEFAULT_WORKSPACE_DIR): Promise<string> {
  const lessonsDir = join(workspaceDir, LESSONS_DIR_NAME);

  let files: string[] = [];
  try {
    files = await readdir(lessonsDir);
  } catch {
    return "";
  }

  const previews = await Promise.all(
    files
      .filter((fileName) => fileName.endsWith(".md"))
      .map(async (fileName) => buildLessonPreview(lessonsDir, fileName))
  );

  const recent = previews
    .filter((preview): preview is LessonPreview => preview !== null)
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(0, MAX_LESSONS);

  if (recent.length === 0) {
    return "";
  }

  let sharedKnowledge = " SHARED KNOWLEDGE (Recent Lessons):";
  for (const lesson of recent) {
    sharedKnowledge += ` | ${lesson.fileName}: ${lesson.preview}`;
  }

  return sharedKnowledge;
}
