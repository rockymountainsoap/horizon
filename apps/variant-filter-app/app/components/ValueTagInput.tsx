import { useState, useCallback, useRef } from "react";
import { BlockStack, InlineStack, Tag, TextField } from "@shopify/polaris";

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  label?: string;
  error?: string;
}

export function ValueTagInput({
  values,
  onChange,
  label = "Values",
  error,
}: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addValue = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed && !values.includes(trimmed)) {
        onChange([...values, trimmed]);
      }
      setInput("");
    },
    [values, onChange]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addValue(input);
    }
    if (e.key === "Backspace" && input === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeValue(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  return (
    <BlockStack gap="200">
      <TextField
        label={label}
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        onBlur={() => input.trim() && addValue(input)}
        helpText="Press Enter or comma to add a value."
        autoComplete="off"
        error={values.length === 0 ? error : undefined}
      />
      {values.length > 0 && (
        <InlineStack gap="100" wrap>
          {values.map((v) => (
            <Tag key={v} onRemove={() => removeValue(v)}>
              {v}
            </Tag>
          ))}
        </InlineStack>
      )}
      {/* Hidden input serialises the array for Remix form submission */}
      <input type="hidden" name="values" value={JSON.stringify(values)} />
    </BlockStack>
  );
}
