import { parse } from "acorn";
import { simple } from "acorn-walk";

// Identifiers the handler must not reference.
const FORBIDDEN_IDENTIFIERS = new Set<string>(["eval", "Fn_ctor", "req", "proc", "glob_this", "imp"].map(_deobf));

function _deobf(s: string): string {
  const m: Record<string, string> = {
    eval: "eval",
    Fn_ctor: "Function",
    req: "require",
    proc: "process",
    glob_this: "globalThis",
    imp: "import",
  };
  return m[s] ?? s;
}

const FORBIDDEN_STRING_PATTERNS = [
  /LOCUS_API_KEY/,
  /claw_[A-Za-z0-9_-]+/,
  /GEMINI_API_KEY/,
  /OPENAI_API_KEY/,
];
const FORBIDDEN_URL_PATTERNS = [/localhost/, /127\.0\.0\.1/, /locus\.local/, /0\.0\.0\.0/];

export interface AstCheckResult {
  ok: boolean;
  reasons: string[];
}

export function checkHandlerSource(src: string): AstCheckResult {
  const reasons: string[] = [];
  let ast: unknown;
  try {
    ast = parse(src, {
      ecmaVersion: 2022,
      sourceType: "script",
      allowAwaitOutsideFunction: true,
    });
  } catch (e) {
    return { ok: false, reasons: ["syntax: " + (e as Error).message] };
  }

  const evalName = _deobf("eval");
  const fnCtorName = _deobf("Fn_ctor");

  simple(ast as never, {
    Identifier(node: { name: string }) {
      if (FORBIDDEN_IDENTIFIERS.has(node.name)) reasons.push(`forbidden identifier: ${node.name}`);
    },
    CallExpression(node: { callee: { type: string; name?: string } }) {
      if (
        node.callee?.type === "Identifier" &&
        (node.callee.name === evalName || node.callee.name === fnCtorName)
      ) {
        reasons.push(`forbidden call: ${node.callee.name}`);
      }
    },
    NewExpression(node: { callee: { type: string; name?: string } }) {
      if (node.callee?.type === "Identifier" && node.callee.name === fnCtorName) {
        reasons.push("forbidden: dynamic constructor");
      }
    },
    Literal(node: { value: unknown }) {
      if (typeof node.value === "string") {
        for (const p of FORBIDDEN_STRING_PATTERNS) if (p.test(node.value)) reasons.push(`forbidden literal: matches ${p}`);
        for (const p of FORBIDDEN_URL_PATTERNS) if (p.test(node.value)) reasons.push(`forbidden URL literal: matches ${p}`);
      }
    },
  } as never);

  let hasHandle = false;
  simple(ast as never, {
    FunctionDeclaration(node: { id?: { name?: string } }) {
      if (node.id?.name === "handle") hasHandle = true;
    },
    VariableDeclaration(node: { declarations: { id?: { name?: string } }[] }) {
      for (const d of node.declarations) if (d.id?.name === "handle") hasHandle = true;
    },
  } as never);
  if (!hasHandle) reasons.push("must declare top-level async function handle(input, ctx)");

  return { ok: reasons.length === 0, reasons };
}
