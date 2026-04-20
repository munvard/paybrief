import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";

export interface BirthCert {
  businessId: string;
  walletAddress: string;
  genome: string;
  parentId: string | null;
  birthDate: string;
  handlerHash: string;
}

async function key() {
  const k = process.env.FOUNDRY_SIGN_SECRET;
  if (!k) throw new Error("FOUNDRY_SIGN_SECRET not set");
  return new TextEncoder().encode(k);
}

export async function signBirthCert(c: BirthCert): Promise<{ jwt: string; sha256: string }> {
  const jwt = await new SignJWT({ ...c })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(await key());
  const sha256 = createHash("sha256").update(jwt).digest("hex");
  return { jwt, sha256 };
}

export async function verifyBirthCert(jwt: string): Promise<BirthCert> {
  const { payload } = await jwtVerify(jwt, await key());
  return payload as unknown as BirthCert;
}

export function handlerHash(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}
