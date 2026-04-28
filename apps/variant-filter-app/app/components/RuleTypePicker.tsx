import { ChoiceList } from "@shopify/polaris";
import type { FilterType } from "~/models/rule.server";

interface Props {
  value: FilterType;
  onChange: (v: FilterType) => void;
}

const CHOICES = [
  {
    label: "Exact match",
    value: "exact" as FilterType,
    helpText: "Show only values that exactly match one of your listed values.",
  },
  {
    label: "Contains",
    value: "contains" as FilterType,
    helpText:
      "Show values whose name contains one of your listed substrings (e.g. 'Litre' matches '1 Litre', '2 Litre').",
  },
  {
    label: "Size range (ml)",
    value: "size_range" as FilterType,
    helpText:
      "Show values up to a maximum volume in ml. Requires option values expressed in ml (e.g. '100ml'). Use Exact match for litre-unit products.",
  },
];

export function RuleTypePicker({ value, onChange }: Props) {
  return (
    <ChoiceList
      title="Filter type"
      choices={CHOICES}
      selected={[value]}
      onChange={(selected) => onChange(selected[0] as FilterType)}
    />
  );
}
