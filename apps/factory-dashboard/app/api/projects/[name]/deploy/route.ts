import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Validate name to prevent path traversal
  if (!/^[a-z0-9-]+$/.test(name)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  const composePath = `/app-factory/apps/${name}/docker-compose.yml`;
  if (!existsSync(composePath)) {
    return NextResponse.json(
      { error: `No docker-compose.yml found for '${name}'` },
      { status: 404 }
    );
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["compose", "-f", composePath, "up", "-d", "--build", "--remove-orphans"],
      { timeout: 60000 }
    );
    return NextResponse.json({
      ok: true,
      message: "Container recreated",
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    });
  } catch (err: unknown) {
    const error = err as { message?: string; stderr?: string };
    console.error("Deploy error:", error);
    return NextResponse.json(
      { error: error.stderr || error.message || "Deploy failed" },
      { status: 500 }
    );
  }
}
