import { readFile } from "node:fs/promises";
import type { PackageMetadata } from "./app-config.js";

const PACKAGE_JSON_URL = new URL("../package.json", import.meta.url);

export async function loadPackageMetadata(): Promise<PackageMetadata> {
  const raw = JSON.parse(await readFile(PACKAGE_JSON_URL, "utf8")) as Partial<PackageMetadata>;

  return {
    name: raw.name ?? "rentify-mcp",
    version: raw.version ?? "0.0.0",
  };
}
