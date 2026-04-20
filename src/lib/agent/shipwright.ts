import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject, createEnvironment } from "../bwl/projects";
import { createService } from "../bwl/services";
import { putVariables } from "../bwl/variables";
import { triggerDeployment, pollUntilTerminal } from "../bwl/deployments";
import { bwlWorkspaceId } from "../bwl/client";

const run = promisify(execFile);

export interface ShipwrightInput {
  businessId: string;
  businessName: string;
  businessPitch: string;
  handlerSource: string;
  walletApiKey: string;
  walletAddress: string;
  sessionSecret: string;
  pricePerCallUsdc: number;
  llmCostEstimateUsdc: number;
  foundryBusUrl: string;
  templatePath: string; // absolute path to business-template/ dir inside container
  onStatus?: (s: string) => void;
}

export interface ShipwrightOutput {
  projectId: string;
  environmentId: string;
  serviceId: string;
  serviceUrl: string;
  deploymentId: string;
  durationMs: number;
}

async function gitCmd(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const r = await run("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return { stdout: r.stdout?.toString?.() ?? String(r.stdout ?? ""), stderr: r.stderr?.toString?.() ?? String(r.stderr ?? "") };
}

export async function runShipwright(i: ShipwrightInput): Promise<ShipwrightOutput> {
  const start = Date.now();

  i.onStatus?.("creating project");
  const project = await createProject(
    `biz-${i.businessId.replace(/^biz_/, "").slice(0, 32)}`,
    i.businessPitch.slice(0, 200)
  );

  i.onStatus?.("creating environment");
  const env = await createEnvironment(project.id, "production", "production");

  i.onStatus?.("creating service");
  const service = await createService({
    projectId: project.id,
    environmentId: env.id,
    name: "handler",
    source: { type: "s3", rootDir: "." },
    runtime: { port: 8080, cpu: 256, memory: 512, minInstances: 1, maxInstances: 1 },
    healthCheckPath: "/health",
  });

  i.onStatus?.("setting variables");
  const handlerB64 = Buffer.from(i.handlerSource, "utf8").toString("base64");
  await putVariables(service.id, {
    LOCUS_API_KEY: i.walletApiKey,
    LOCUS_API_BASE_URL: process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api",
    FOUNDRY_BUS_URL: i.foundryBusUrl,
    BUSINESS_ID: i.businessId,
    BUSINESS_NAME: i.businessName,
    BUSINESS_PITCH: i.businessPitch,
    BUSINESS_WALLET_ADDRESS: i.walletAddress,
    BIZ_SESSION_SECRET: i.sessionSecret,
    PRICE_PER_CALL_USDC: String(i.pricePerCallUsdc),
    LLM_COST_ESTIMATE_USDC: String(i.llmCostEstimateUsdc),
    HANDLER_SOURCE_B64: handlerB64,
  });

  i.onStatus?.("preparing git push");
  const tmp = await mkdtemp(join(tmpdir(), `biz-${i.businessId}-`));
  try {
    // Copy template contents into tmp dir
    await cp(i.templatePath, tmp, { recursive: true });
    // Wipe any inherited node_modules / dist that may have snuck in
    for (const dir of ["node_modules", "dist"]) {
      await rm(join(tmp, dir), { recursive: true, force: true });
    }
    // Ensure .gitignore excludes them
    await writeFile(join(tmp, ".gitignore"), "node_modules/\ndist/\n*.log\n", "utf8");

    await gitCmd(tmp, ["init", "-q", "-b", "main"]);
    await gitCmd(tmp, ["-c", "user.email=foundry@foundry.ai", "-c", "user.name=foundry", "add", "-A"]);
    await gitCmd(tmp, ["-c", "user.email=foundry@foundry.ai", "-c", "user.name=foundry", "commit", "-q", "-m", `biz ${i.businessId} initial deploy`]);

    const workspaceId = bwlWorkspaceId();
    const apiKey = process.env.LOCUS_API_KEY;
    if (!apiKey) throw new Error("LOCUS_API_KEY not set for shipwright git push");
    const remote = `https://x:${apiKey}@beta-git.buildwithlocus.com/${workspaceId}/${project.id}.git`;
    await gitCmd(tmp, ["remote", "add", "locus", remote]);

    i.onStatus?.("pushing to BWL git");
    var pushResult = await gitCmd(tmp, ["push", "locus", "main"]);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }

  // BWL's git server streams the triggered deployment id in stderr. Parse it.
  const combined = (pushResult?.stdout ?? "") + "\n" + (pushResult?.stderr ?? "");
  const deployIdMatch = combined.match(/deploy_[a-z0-9]+/);
  let deploymentId = deployIdMatch?.[0] ?? "";

  // Fallback: if parsing failed, manually trigger a deployment.
  if (!deploymentId) {
    const d = await triggerDeployment(service.id);
    deploymentId = d.id;
  }

  i.onStatus?.(`deploying (${deploymentId})`);
  await pollUntilTerminal(deploymentId, {
    intervalMs: 20000,
    timeoutMs: 7 * 60 * 1000,
    onStatus: (s) => i.onStatus?.(`deploy: ${s}`),
  });

  return {
    projectId: project.id,
    environmentId: env.id,
    serviceId: service.id,
    serviceUrl: service.url,
    deploymentId,
    durationMs: Date.now() - start,
  };
}
