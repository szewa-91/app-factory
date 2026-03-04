import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { stat, open } from "fs/promises";
import path from "path";
import { Readable } from "stream";

// Base directory for the whole app-factory
// In Docker, this is mounted as /app-factory (read-only)
const BASE_DIR = path.resolve(process.env.LOGS_DIR || path.join(process.cwd(), "../../"));

/**
 * Robustly reads the last N lines from a file by reading from the end in chunks.
 */
async function readLastLines(filePath: string, linesCount: number): Promise<string> {
  const fileHandle = await open(filePath, "r");
  try {
    const fileStat = await fileHandle.stat();
    const fileSize = fileStat.size;
    const CHUNK_SIZE = 64 * 1024; // 64KB chunks
    let lines: string[] = [];
    let position = fileSize;
    let buffer = Buffer.alloc(CHUNK_SIZE);
    let remainder = "";

    while (lines.length < linesCount && position > 0) {
      const readSize = Math.min(position, CHUNK_SIZE);
      position -= readSize;

      await fileHandle.read(buffer, 0, readSize, position);
      const chunk = buffer.toString("utf-8", 0, readSize) + remainder;
      const split = chunk.split("\n");
      
      // The first element of split might be incomplete unless we are at the start of the file
      if (position > 0) {
        remainder = split.shift() || "";
      } else {
        remainder = "";
      }

      // Add lines from current chunk (in reverse order because we are reading backwards)
      lines = split.concat(lines);
    }

    return lines.slice(-linesCount).join("\n");
  } finally {
    await fileHandle.close();
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Basic security check is already handled by middleware (session check)
    // Here we add path-level protection.

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'factory', 'task', or 'agent'
    const projectName = searchParams.get("project") || "factory-dashboard";
    const taskId = searchParams.get("task_id");
    const linesStr = searchParams.get("lines");
    const offsetStr = searchParams.get("offset");

    let filePath = "";

    if (type === "factory") {
      filePath = path.join(BASE_DIR, "factory.log");
    } else if (type === "task" && taskId) {
      // Security: ensure taskId is a simple number or alphanumeric to prevent path traversal
      if (!/^\d+$/.test(taskId)) {
          return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
      }
      // app-factory tasks are stored in the root BASE_DIR
      if (projectName === "app-factory") {
          filePath = path.join(BASE_DIR, `agent_task_${taskId}.log`);
      } else {
          filePath = path.join(BASE_DIR, "apps", projectName, `agent_task_${taskId}.log`);
      }
    } else if (type === "agent") {
      if (projectName === "app-factory") {
          filePath = path.join(BASE_DIR, "agent.log");
      } else {
          filePath = path.join(BASE_DIR, "apps", projectName, "agent.log");
      }
    } else {
      return NextResponse.json({ error: "Invalid log type or missing parameters" }, { status: 400 });
    }

    // Security: Ensure path is within BASE_DIR and is a .log file
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(BASE_DIR) || !resolvedPath.endsWith(".log")) {
      console.warn(`Unauthorized log access attempt: ${resolvedPath} (BASE_DIR: ${BASE_DIR})`);
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Log file not found" }, { status: 404 });
    }

    const fileStat = await stat(resolvedPath);
    const fileSize = fileStat.size;

    // Case 1: Tailing logic from a specific byte offset (streaming)
    if (offsetStr) {
      const offset = parseInt(offsetStr, 10);
      if (!isNaN(offset)) {
        // If offset is greater than current size, the file might have been rotated
        // In that case, start from 0 or return empty? Let's return from 0 if offset > size.
        const start = offset > fileSize ? 0 : offset;
        const nodeStream = fs.createReadStream(resolvedPath, { start });
        const webStream = Readable.toWeb(nodeStream);
        return new Response(webStream as any, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Log-Offset': fileSize.toString()
            }
        });
      }
    }

    // Case 2: Last N lines logic (robust)
    if (linesStr) {
        const linesCount = Math.min(parseInt(linesStr, 10) || 100, 5000); // Limit to 5000 lines
        const content = await readLastLines(resolvedPath, linesCount);
        
        return new Response(content, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Log-Offset': fileSize.toString()
            }
        });
    }

    // Case 3: Default behavior - return the last 1MB of the file
    const MAX_SIZE = 1024 * 1024; // 1MB
    const start = Math.max(0, fileSize - MAX_SIZE);
    const nodeStream = fs.createReadStream(resolvedPath, { start });
    const webStream = Readable.toWeb(nodeStream);
    
    return new Response(webStream as any, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Log-Offset': fileSize.toString(),
            'Warning': fileSize > MAX_SIZE ? 'File truncated to last 1MB' : ''
        }
    });

  } catch (error) {
    console.error("Error serving logs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
