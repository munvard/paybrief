import { bwl } from "./client";

export async function putVariables(serviceId: string, variables: Record<string, string>) {
  return bwl(`/variables/service/${serviceId}`, {
    method: "PUT",
    body: { variables },
  });
}

export async function patchVariables(serviceId: string, variables: Record<string, string>) {
  return bwl(`/variables/service/${serviceId}`, {
    method: "PATCH",
    body: { variables },
  });
}
