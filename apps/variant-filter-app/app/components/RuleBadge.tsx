import { Badge } from "@shopify/polaris";
import type { FilterRule } from "~/models/rule.server";

interface Props {
  rule: FilterRule | null;
}

export function RuleBadge({ rule }: Props) {
  if (!rule) return <Badge>No rule</Badge>;
  return <Badge tone="success">{rule.label}</Badge>;
}
