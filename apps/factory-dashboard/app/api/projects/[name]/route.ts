import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const project = await prisma.project.findUnique({
      where: { name },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();

    const updatedProject = await prisma.project.update({
      where: { name },
      data: body,
    });

    // If domain changed, update app's config files
    if (typeof body.domain === "string") {
      const appPath = `/app-factory/apps/${name}`;

      // Update docker-compose.yml
      const composePath = `${appPath}/docker-compose.yml`;
      if (existsSync(composePath)) {
        try {
          let compose = readFileSync(composePath, "utf8");
          compose = compose.replace(
            /Host\(`[^`]*`\)/g,
            `Host(\`${body.domain}\`)`
          );
          writeFileSync(composePath, compose, "utf8");
        } catch (fsErr) {
          console.error(`Failed to update docker-compose.yml for ${name}:`, fsErr);
        }
      }

      // Update verify.sh PUBLIC_URL
      const verifyPath = `${appPath}/verify.sh`;
      if (existsSync(verifyPath)) {
        try {
          let verify = readFileSync(verifyPath, "utf8");
          verify = verify.replace(
            /PUBLIC_URL="https:\/\/[^"]*"/,
            `PUBLIC_URL="https://${body.domain}"`
          );
          writeFileSync(verifyPath, verify, "utf8");
        } catch (fsErr) {
          console.error(`Failed to update verify.sh for ${name}:`, fsErr);
        }
      }

      // Update CLAUDE.md Domain field
      const claudePath = `${appPath}/CLAUDE.md`;
      if (existsSync(claudePath)) {
        try {
          let claude = readFileSync(claudePath, "utf8");
          claude = claude.replace(
            /Domain: [^\n]*/,
            `Domain: ${body.domain}`
          );
          writeFileSync(claudePath, claude, "utf8");
        } catch (fsErr) {
          console.error(`Failed to update CLAUDE.md for ${name}:`, fsErr);
        }
      }
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
