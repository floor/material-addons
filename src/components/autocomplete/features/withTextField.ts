import { createTextField } from "material/components/text-field";
import type { BaseConfig } from "../config";
import { AUTOCOMPLETE_CLASSES as classes } from "../constants";

const icon = (path: string) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="${path}"/></svg>`;
const chevron = icon("m7 10 5 5 5-5z");
const clear = icon("m6 7 1-1 5 5 5-5 1 1-5 5 5 5-1 1-5-5-5 5-1-1 5-5z");

export function withTextField<T>(config: BaseConfig<T>) {
  const textField = createTextField({
    variant: config.variant, density: config.density, label: config.label,
    placeholder: config.placeholder, supportingText: config.supportingText,
    error: config.error, required: config.required, noAsterisk: config.noAsterisk,
    disabled: config.disabled, readonly: config.readonly, leadingIcon: config.leadingIcon,
    prefixText: config.prefixText, suffixText: config.suffixText, ariaLabel: config.ariaLabel,
    class: config.class,
    controlLabelOnly: true, autocomplete: "off",
    trailingIcon: config.trailingIcon ?? chevron,
    trailingIconLabel: config.trailingIconLabel ?? "Show suggestions",
  });
  const { element, field } = textField;
  const input = textField.input as HTMLInputElement;
  element.classList.add(classes.ROOT, `mtrl-${config.componentName}`);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  const status = document.createElement("div");
  status.className = classes.STATUS;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  element.append(status);

  // The editable text is a label; native forms submit the committed model.
  const formValue = document.createElement("input");
  formValue.type = "hidden";
  if (config.name) {
    formValue.name = config.name;
    element.append(formValue);
  }
  let showingClear = false;
  const canClear = () => config.clearable && !!input.value && !input.disabled && !input.readOnly;
  const sync = (value: string | null) => {
    formValue.value = value ?? "";
    formValue.disabled = input.disabled || value === null;
    const next = canClear();
    if (next !== showingClear) {
      showingClear = next;
      textField.setTrailingIcon(config.trailingIcon ?? (next ? clear : chevron),
        config.trailingIconLabel ?? (next ? "Clear" : "Show suggestions"));
    }
    if (config.strict) input.setCustomValidity(input.required && value === null && input.value ? "Select a suggestion." : "");
  };
  return { textField, element, field, input, status, canClear, sync };
}
