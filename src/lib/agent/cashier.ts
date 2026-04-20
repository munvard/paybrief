import { randomUUID } from "node:crypto";
import { registerSubAgent, resolveSmartWalletAddress } from "../locus/register";
import { setWalletPolicyWithKey } from "../locus/policy";
import { locusRequest } from "../locus/client";
import { signBirthCert, handlerHash, type BirthCert } from "../birth-cert";
import { encryptString } from "../crypto";

export interface CashierInput {
  businessId: string;
  businessName: string;
  genome: string;
  parentId: string | null;
  handlerSource: string;
  seedUsdc: number;
}

export interface CashierOutput {
  apiKey: string;
  walletAddress: string; // smart wallet address (operational)
  ownerAddress: string; // EOA (recovery only, not injected)
  walletApiKeyEnc: string;
  sessionSecret: string;
  birthCertJwt: string;
  birthCertSha256: string;
}

export async function runCashier(i: CashierInput): Promise<CashierOutput> {
  const { persistable } = await registerSubAgent(i.businessName);
  const { apiKey, ownerAddress } = persistable;

  // Resolve the actual smart wallet address (different from EOA ownerAddress)
  const walletAddress = await resolveSmartWalletAddress(apiKey, 30000);

  const walletApiKeyEnc = encryptString(apiKey);

  await setWalletPolicyWithKey(apiKey, {
    allowanceUsdc: 10,
    maxAllowedTxnSizeUsdc: 5,
    approvalThresholdUsdc: 10,
  });

  // Seed the business's smart wallet from Foundry master
  await locusRequest("/pay/send", {
    method: "POST",
    body: {
      to_address: walletAddress,
      amount: i.seedUsdc,
      memo: `seed for ${i.businessId}`,
    },
  });

  const cert: BirthCert = {
    businessId: i.businessId,
    walletAddress,
    genome: i.genome,
    parentId: i.parentId,
    birthDate: new Date().toISOString(),
    handlerHash: handlerHash(i.handlerSource),
  };
  const { jwt: birthCertJwt, sha256: birthCertSha256 } = await signBirthCert(cert);

  const sessionSecret =
    randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");

  return {
    apiKey,
    walletAddress,
    ownerAddress,
    walletApiKeyEnc,
    sessionSecret,
    birthCertJwt,
    birthCertSha256,
  };
}
