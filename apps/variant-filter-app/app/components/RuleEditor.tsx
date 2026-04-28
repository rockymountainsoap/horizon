import { useState } from "react";
import {
  BlockStack,
  Card,
  Select,
  TextField,
  Text,
  Divider,
} from "@shopify/polaris";
import { RuleTypePicker } from "~/components/RuleTypePicker";
import { ValueTagInput } from "~/components/ValueTagInput";
import type { FilterRule, FilterType } from "~/models/rule.server";

interface Props {
  defaultValues: FilterRule | null;
  optionNames: string[];
  errors?: Record<string, string[]>;
}

export function RuleEditor({ defaultValues, optionNames, errors = {} }: Props) {
  const [filterType, setFilterType] = useState<FilterType>(
    defaultValues?.filterType ?? "exact"
  );
  const [option, setOption] = useState(defaultValues?.option ?? "");
  const [values, setValues] = useState<string[]>(
    defaultValues && "values" in defaultValues ? defaultValues.values : []
  );
  const [maxMl, setMaxMl] = useState(
    defaultValues?.filterType === "size_range"
      ? String(defaultValues.maxMl)
      : ""
  );
  const [label, setLabel] = useState(defaultValues?.label ?? "");

  const optionChoices = [
    { label: "Select an option", value: "" },
    ...optionNames.map((n) => ({ label: n, value: n })),
  ];

  return (
    <BlockStack gap="400">
      <Text as="p" variant="bodyMd" tone="subdued">
        Set a rule to control which variant option values shoppers see in this
        collection. All other options (e.g. Color) are always shown in full.
      </Text>

      <RuleTypePicker value={filterType} onChange={setFilterType} />

      <Divider />

      <Select
        label="Option to filter"
        options={optionChoices}
        value={option}
        onChange={setOption}
        error={errors.option?.[0]}
        helpText="Choose the product option this rule applies to."
      />
      {/* Hidden input for option — Select already serialises via name */}
      <input type="hidden" name="filterType" value={filterType} />
      <input type="hidden" name="option" value={option} />

      {(filterType === "exact" || filterType === "contains") && (
        <ValueTagInput
          values={values}
          onChange={setValues}
          label={
            filterType === "exact"
              ? "Allowed values (exact)"
              : "Allowed substrings"
          }
          error={errors.values?.[0]}
        />
      )}

      {filterType === "size_range" && (
        <TextField
          label="Maximum volume (ml)"
          type="number"
          name="maxMl"
          value={maxMl}
          onChange={setMaxMl}
          min={1}
          suffix="ml"
          error={errors.maxMl?.[0]}
          helpText="Show variants with a volume ≤ this value. Requires option values in ml (e.g. '100ml')."
          autoComplete="off"
        />
      )}

      <TextField
        label="Display label"
        name="label"
        value={label}
        onChange={setLabel}
        error={errors.label?.[0]}
        helpText="Shown in the admin overview and optionally on the storefront badge."
        autoComplete="off"
      />
    </BlockStack>
  );
}
