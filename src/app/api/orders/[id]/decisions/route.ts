import { NextRequest, NextResponse } from "next/server";
import { getDecisionsByOrderId } from "@/lib/db/queries";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const afterStep = req.nextUrl.searchParams.get("after");

  const decisions = await getDecisionsByOrderId(
    id,
    afterStep ? Number(afterStep) : undefined
  );

  return NextResponse.json({ decisions });
}
