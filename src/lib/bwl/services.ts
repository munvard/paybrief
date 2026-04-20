import { bwl } from "./client";

export interface ServiceConfig {
  projectId: string;
  environmentId: string;
  name: string;
  source:
    | { type: "image"; imageUri: string }
    | { type: "github"; repo: string; branch?: string }
    | { type: "s3"; rootDir?: string };
  runtime?: {
    port?: number;
    cpu?: number;
    memory?: number;
    minInstances?: number;
    maxInstances?: number;
  };
  healthCheckPath?: string;
}

export async function createService(cfg: ServiceConfig) {
  return bwl<{ id: string; url: string; name: string }>("/services", {
    method: "POST",
    body: cfg,
  });
}

export async function restartService(serviceId: string) {
  return bwl(`/services/${serviceId}/restart`, { method: "POST" });
}

export async function deleteService(serviceId: string) {
  return bwl(`/services/${serviceId}`, { method: "DELETE" });
}

export async function getService(serviceId: string, includeRuntime = false) {
  return bwl(`/services/${serviceId}${includeRuntime ? "?include=runtime" : ""}`);
}
