import type { InferSchema, Schema, SchemaField } from "../core/types.js";

export class JsonParseError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = "JsonParseError";
  }
}

/**
 * Pulls the first valid JSON value out of free-form model output. Models often
 * wrap JSON in markdown fences or add chatter, so we strip fences and scan for
 * a balanced object/array if a direct parse fails.
 */
export function extractJson(raw: string): unknown {
  const text = stripFences(raw).trim();

  try {
    return JSON.parse(text);
  } catch {
    // fall through to balanced-scan
  }

  const candidate = findBalanced(text);
  if (candidate !== null) {
    try {
      return JSON.parse(candidate);
    } catch {
      // fall through
    }
  }

  throw new JsonParseError("Could not parse JSON from model output", raw);
}

function stripFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers.
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return fence ? fence[1] : text;
}

/** Finds the first balanced {...} or [...] region in the text. */
function findBalanced(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;

  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Coerces a parsed JSON value to match `schema`, validating enums and types.
 * Throws if a required key is missing or an enum value is not allowed.
 */
export function coerceToSchema<S extends Schema>(
  value: unknown,
  schema: S,
): InferSchema<S> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new JsonParseError(
      `Expected a JSON object, received ${describeType(value)}`,
      JSON.stringify(value),
    );
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    out[key] = coerceField(obj[key], field, key);
  }
  return out as InferSchema<S>;
}

function coerceField(value: unknown, field: SchemaField, key: string): unknown {
  if (field === "string") return coerceString(value);
  if (field === "number") return coerceNumber(value, key);
  if (field === "boolean") return coerceBoolean(value);

  if (Array.isArray(field)) {
    const str = coerceString(value).trim();
    const match = field.find(
      (allowed) => allowed.toLowerCase() === str.toLowerCase(),
    );
    if (match === undefined) {
      throw new JsonParseError(
        `Field "${key}" value "${str}" is not one of [${field.join(", ")}]`,
        str,
      );
    }
    return match;
  }

  // Nested schema.
  return coerceToSchema(value, field as Schema);
}

function coerceString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function coerceNumber(value: unknown, key: string): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  if (value === null || value === undefined || value === "") return 0;
  throw new JsonParseError(`Field "${key}" is not a number`, String(value));
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(v)) return true;
    if (["false", "no", "0", ""].includes(v)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/** Picks the allowed label closest to a free-form classification response. */
export function matchLabel(raw: string, labels: string[]): string {
  const text = stripFences(raw).trim().replace(/^["']|["']$/g, "");

  // Exact (case-insensitive) match first.
  const exact = labels.find((l) => l.toLowerCase() === text.toLowerCase());
  if (exact) return exact;

  // Then a label contained in the response (longest match wins).
  const lower = text.toLowerCase();
  const contained = labels
    .filter((l) => lower.includes(l.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  if (contained.length) return contained[0];

  // Then a response contained in a label.
  const reverse = labels.find((l) => l.toLowerCase().includes(lower) && lower);
  if (reverse) return reverse;

  throw new JsonParseError(
    `Classification "${text}" did not match any of [${labels.join(", ")}]`,
    raw,
  );
}
