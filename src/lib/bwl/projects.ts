import { bwl } from "./client";

export async function createProject(name: string, description?: string) {
  return bwl<{ id: string; name: string; region: string; workspaceId: string }>("/projects", {
    method: "POST",
    body: { name, description: description ?? "" },
  });
}

export async function createEnvironment(
  projectId: string,
  name = "production",
  type: "development" | "staging" | "production" = "production"
) {
  return bwl<{ id: string; name: string; projectId: string }>(
    `/projects/${projectId}/environments`,
    { method: "POST", body: { name, type } }
  );
}

export async function deleteProject(projectId: string) {
  return bwl(`/projects/${projectId}`, { method: "DELETE" });
}
