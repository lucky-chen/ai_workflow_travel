import fs from "node:fs/promises";
import process from "node:process";

export async function loadLocalEnv(baseUrl: string): Promise<void> {
  const candidates = [
    new URL("./local.env.json", baseUrl),
    new URL("../local.env.json", baseUrl),
  ];

  for (const url of candidates) {
    try {
      const raw = await fs.readFile(url, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && !process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
