import type { Schema, SchemaField } from "../core/types.js";

/**
 * Renders a schema into a human/LLM-readable description used inside prompts.
 * Example: `{ name: "string", urgency: ["low","high"] }` becomes
 *   - "name": string
 *   - "urgency": one of ["low", "high"]
 */
export function describeSchema(schema: Schema, indent = ""): string {
  const lines: string[] = [];
  for (const [key, field] of Object.entries(schema)) {
    lines.push(`${indent}- "${key}": ${describeField(field, indent)}`);
  }
  return lines.join("\n");
}

function describeField(field: SchemaField, indent: string): string {
  if (field === "string" || field === "number" || field === "boolean") {
    return field;
  }
  if (Array.isArray(field)) {
    return `one of [${field.map((v) => `"${v}"`).join(", ")}]`;
  }
  // Nested object schema.
  return `object with fields:\n${describeSchema(field as Schema, indent + "  ")}`;
}

/** Builds a JSON skeleton example from a schema to anchor the model. */
export function schemaExample(schema: Schema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    out[key] = fieldExample(field);
  }
  return out;
}

function fieldExample(field: SchemaField): unknown {
  if (field === "string") return "...";
  if (field === "number") return 0;
  if (field === "boolean") return false;
  if (Array.isArray(field)) return field[0] ?? "...";
  return schemaExample(field as Schema);
}

export function buildSerializePrompt(text: string, schema: Schema): string {
  return [
    "Extract structured data from the input text below.",
    "Return ONLY a single JSON object — no prose, no markdown fences.",
    "Use this exact shape; every key must be present:",
    describeSchema(schema),
    "",
    "Example of the JSON shape (values are placeholders):",
    JSON.stringify(schemaExample(schema)),
    "",
    "If a value is genuinely absent in the text, use an empty string,",
    "0, or false as appropriate for its type.",
    "",
    "INPUT TEXT:",
    text,
  ].join("\n");
}

export function buildClassifyPrompt(text: string, labels: string[]): string {
  return [
    "Classify the input text into exactly one of the allowed labels.",
    `Allowed labels: [${labels.map((l) => `"${l}"`).join(", ")}]`,
    "Respond with ONLY the chosen label, verbatim, and nothing else.",
    "",
    "INPUT TEXT:",
    text,
  ].join("\n");
}

export function buildExtractPrompt(text: string, fields: string[]): string {
  return [
    "Extract the requested fields from the input text.",
    `Fields to find: [${fields.map((f) => `"${f}"`).join(", ")}]`,
    "Return ONLY a JSON object whose keys are the requested field names.",
    "Omit a key entirely if its value is not present in the text.",
    "",
    "INPUT TEXT:",
    text,
  ].join("\n");
}

export function buildReplacePrompt(text: string, instruction: string): string {
  return [
    "Rewrite the input text according to the instruction.",
    "Return ONLY the rewritten text — no quotes, no explanation, no preamble.",
    "",
    `INSTRUCTION: ${instruction}`,
    "",
    "INPUT TEXT:",
    text,
  ].join("\n");
}
