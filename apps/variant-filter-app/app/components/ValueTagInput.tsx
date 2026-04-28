import { useCallback, useState } from "react";
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

  function removeValue(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  // Polaris 13 `TextField` doesn't expose `onKeyDown`, so we attach the
  // keydown listener to a wrapping div. The event bubbles from the
  // underlying `<input>` so this catches Enter, comma, and Backspace.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addValue(input);
      return;
    }
    if (e.key === "Backspace" && input === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <BlockStack gap="200">
      <div onKeyDown={handleKeyDown}>
        <TextField
          label={label}
          value={input}
          onChange={setInput}
          onBlur={() => {
            if (input.trim()) addValue(input);
          }}
          helpText="Press Enter or comma to add a value."
          autoComplete="off"
          error={values.length === 0 ? error : undefined}
        />
      </div>
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
