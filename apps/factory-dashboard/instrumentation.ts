export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const fs = await import("fs");
    const path = await import("path");
    const { default: prisma } = await import("@/lib/prisma");

    console.log("Running DB healthcheck and hardening on startup...");
    console.log(`Current process: UID=${process.getuid?.()}, GID=${process.getgid?.()}`);

    // 1. Check DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("CRITICAL: DATABASE_URL environment variable is not set.");
      process.exit(1);
    }

    // 2. If it's a file, check existence and permissions
    if (dbUrl.startsWith("file:")) {
      const dbPath = dbUrl.replace("file:", "");
      const absoluteDbPath = path.resolve(process.cwd(), dbPath);
      const dbDir = path.dirname(absoluteDbPath);

      console.log(`Checking DB at: ${absoluteDbPath}`);

      // Check if file exists
      if (!fs.existsSync(absoluteDbPath)) {
        console.warn(`WARNING: DB file not found at ${absoluteDbPath}. Prisma will try to create it.`);
      } else {
        // Check permissions
        try {
          fs.accessSync(absoluteDbPath, fs.constants.R_OK | fs.constants.W_OK);
          console.log("DB file permissions verified (Read/Write OK).");
        } catch (err) {
          console.error(`CRITICAL: DB file at ${absoluteDbPath} is not readable/writable.`);
          console.error(err);
          process.exit(1);
        }
      }

      // Check directory permissions (important for SQLite journal files)
      try {
        fs.accessSync(dbDir, fs.constants.W_OK);
        console.log("DB directory permissions verified (Write OK).");
      } catch (err) {
        console.error(`CRITICAL: DB directory ${dbDir} is not writable. SQLite may fail to create journal files.`);
        console.error(err);
        process.exit(1);
      }
    }

    // 3. Attempt to connect via Prisma
    try {
      await prisma.$connect();
      // Run a simple query to verify connection
      await prisma.$queryRaw`SELECT 1`;
      console.log("Prisma DB connection established and verified successfully.");
    } catch (error) {
      console.error("CRITICAL: Failed to connect to the database via Prisma:");
      console.error(error);
      process.exit(1);
    }
  }
}
