import { config } from "dotenv";
import { fileURLToPath } from "node:url";

const envFilePath = fileURLToPath(new URL("../../../../.env", import.meta.url));

let isEnvironmentLoaded = false;

export function loadEnvironment(): NodeJS.ProcessEnv {
  if (isEnvironmentLoaded) {
    return process.env;
  }

  config({
    path: envFilePath,
  });

  isEnvironmentLoaded = true;

  return process.env;
}

export const environment = process.env;

export function getEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getOptionalEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}
