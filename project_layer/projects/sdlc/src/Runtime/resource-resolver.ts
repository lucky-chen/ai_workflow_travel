import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ResourceDirectoryConfig {
  docDir?: string;
  distDir?: string;
  templateDir?: string;
  contractDir?: string;
}

export interface ResourceResolverConfig {
  workdir?: string;
  resource?: ResourceDirectoryConfig;
}

let currentResourceResolverConfig: ResourceResolverConfig = {};

const DEFAULT_RESOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../resources");

export function configureResourceResolver(config: Partial<ResourceResolverConfig>): void {
  currentResourceResolverConfig = {
    ...currentResourceResolverConfig,
    ...config,
  };
}

export function resetResourceResolverConfig(): void {
  currentResourceResolverConfig = {};
}

export function getDocDir(): string {
  return getConfiguredDirectory("docDir", DEFAULT_RESOURCE_ROOT);
}

export function getDistDir(): string {
  return getConfiguredDirectory("distDir", DEFAULT_RESOURCE_ROOT);
}

export function getTemplateDir(): string {
  return getConfiguredDirectory("templateDir", path.join(DEFAULT_RESOURCE_ROOT, "template"));
}

export function getContractDir(): string {
  return getConfiguredDirectory("contractDir", path.join(DEFAULT_RESOURCE_ROOT, "contract"));
}

function getConfiguredDirectory(
  key: keyof ResourceDirectoryConfig,
  defaultPath: string,
): string {
  const configuredDirectory = currentResourceResolverConfig.resource?.[key];
  if (!configuredDirectory) {
    return defaultPath;
  }

  if (path.isAbsolute(configuredDirectory)) {
    return path.resolve(configuredDirectory);
  }

  const workdir = currentResourceResolverConfig.workdir;
  if (!workdir) {
    throw new Error("Resource resolver requires workdir.");
  }

  return path.resolve(workdir, configuredDirectory);
}
