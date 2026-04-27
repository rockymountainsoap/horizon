import { z } from "zod";

export type FilterType = "exact" | "contains" | "size_range";

export type FilterRule =
  | { filterType: "exact"; option: string; values: string[]; label: string }
  | { filterType: "contains"; option: string; values: string[]; label: string }
  | { filterType: "size_range"; option: string; maxMl: number; label: string };

const base = {
  option: z.string().min(1, "Option name is required"),
  label: z.string().min(1, "Display label is required"),
};

export const FilterRuleSchema = z.discriminatedUnion("filterType", [
  z.object({
    filterType: z.literal("exact"),
    ...base,
    values: z.array(z.string().min(1)).min(1, "Add at least one value"),
  }),
  z.object({
    filterType: z.literal("contains"),
    ...base,
    values: z.array(z.string().min(1)).min(1, "Add at least one value"),
  }),
  z.object({
    filterType: z.literal("size_range"),
    ...base,
    maxMl: z.coerce
      .number()
      .int("Must be a whole number")
      .positive("Must be greater than zero"),
  }),
]);

export function parseRule(rawValue: unknown): FilterRule | null {
  if (!rawValue) return null;
  try {
    const obj =
      typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    const result = FilterRuleSchema.safeParse(obj);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
