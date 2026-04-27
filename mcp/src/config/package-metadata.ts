import { readFile } from "node:fs/promises";
import type { PackageMetadata } from "./app-config.js";

const PACKAGE_JSON_URLS = [
  new URL("../../package.json", import.meta.url),
  new URL("../package.json", import.meta.url),
];

export async function loadPackageMetadata(): Promise<PackageMetadata> {
  for (const packageJsonUrl of PACKAGE_JSON_URLS) {
    try {
      const raw = JSON.parse(await readFile(packageJsonUrl, "utf8")) as Partial<PackageMetadata>;

      return {
        name: raw.name ?? "rentify-mcp",
        version: raw.version ?? "0.0.0",
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return {
    name: "rentify-mcp",
    version: "0.0.0",
  };
}
