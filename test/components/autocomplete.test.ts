import { afterEach, expect, test } from "bun:test";
import { createAutocomplete, type AutocompleteComponent, type AutocompleteConfig } from "../../src/components/autocomplete";
import { installAutocompleteDom } from "../utils/autocomplete-dom";
import { readListboxStyle } from "../../scripts/listbox-style.mjs";

let component: AutocompleteComponent | undefined;
afterEach(() => {
  component?.destroy();
  component = undefined;
});
installAutocompleteDom();

const mount = (config: AutocompleteConfig = {}) => {
  component = createAutocomplete(config);
  document.body.append(component.element);
  return { component, input: component.textField.input as HTMLInputElement, box: component.listbox };
};
const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const key = (input: HTMLElement, key: string, altKey = false) => {
  const event = new window.KeyboardEvent("keydown", { key, altKey, cancelable: true, bubbles: true });
  input.dispatchEvent(event);
  return event.defaultPrevented;
};
const rows = (box: HTMLElement) => Array.from(box.querySelectorAll<HTMLElement>('[role=option]'));

test("Material's listbox stylesheet entry and popup class contract are present", () => {
  const sheet = readListboxStyle();
  for (const name of ["mtrl-listbox", "mtrl-listbox__option", "mtrl-listbox__option--active"]) {
    if (!new RegExp(`\\.${name}(?![\\w-])`).test(sheet)) {
      throw new Error(`material/styles/listbox no longer styles .${name}; review the autocomplete popup contract`);
    }
  }
});

test("uses the Material text field, including density, errors, affixes and readonly", () => {
  const { component, input, box } = mount({
    variant: "outlined", density: "compact", label: "City", placeholder: "Type",
    supportingText: "Help", required: true, noAsterisk: true, disabled: true, readonly: true,
    leadingIcon: "<svg></svg>", trailingIcon: "<svg></svg>", prefixText: "+", suffixText: "EUR",
    error: true, options: ["Paris"],
  });
  const field = component.textField;
  expect(field.getVariant()).toBe("outlined");
  expect(field.getDensity()).toBe("compact");
  expect(field.getLabel()).toBe("City");
  expect(field.leadingIcon?.querySelector("svg")).not.toBeNull();
  expect(field.trailingIcon?.querySelector("svg")).not.toBeNull();
  expect(field.supportingTextElement?.textContent).toContain("Help");
  expect(field.prefixTextElement?.textContent).toBe("+");
  expect(field.suffixTextElement?.textContent).toBe("EUR");
  expect(input.placeholder).toBe("Type");
  expect(input.required && input.disabled && input.readOnly).toBe(true);
  expect(field.isError()).toBe(true);
  expect(box.getAttribute("popover")).toBe("manual");
  expect(input.getAttribute("aria-autocomplete")).toBe("list");
  expect(component.enable().open().isOpen()).toBe(false);
});

test("filters both lines and highlights query text without parsing labels as markup", () => {
  const { input, box, component } = mount({
    minLength: 2, options: ["<script>City</script>", { text: "Amsterdam", supportingText: "Script host" }, "Other"],
  });
  type(input, "s");
  expect(component.isOpen()).toBe(false);
  type(input, "script");
  expect(component.isOpen()).toBe(true);
  expect(input.getAttribute("aria-controls")).toBe(box.id);
  expect(rows(box)).toHaveLength(2);
  expect(rows(box)[0].querySelector("mark")?.textContent).toBe("script");
  expect(rows(box)[0].textContent).toBe("<script>City</script>");
  expect(rows(box)[0].querySelector("script")).toBeNull();
  expect(component.element.querySelector('[role="status"]')?.textContent).toBe("2 options available");
});

test("supports custom and server-only filtering", () => {
  const result = mount({ options: ["Paris", "Lisbon"], filter: (option, query) => option.text.endsWith(query) });
  type(result.input, "on");
  expect(rows(result.box).map(row => row.textContent)).toEqual(["Lisbon"]);
  result.component.destroy();
  const unfiltered = mount({ options: ["London", "Bern"], filter: false });
  type(unfiltered.input, "other");
  expect(rows(unfiltered.box)).toHaveLength(2);
});

test("keeps editable keys native, skips disabled suggestions, and commits a stable value", () => {
  const seen: Array<string | null> = [];
  const { component, input, box } = mount({
    openOnFocus: false,
    options: [{ text: "Unavailable", disabled: true }, { id: "ch", text: "Switzerland" }, "Japan"],
    onSelect: event => seen.push(event.value),
    on: { change: event => seen.push(event.previousValue) },
  });
  input.focus();
  expect(key(input, "ArrowDown")).toBe(true);
  expect(input.getAttribute("aria-activedescendant")).toBe(rows(box)[1].id);
  expect(key(input, "Home")).toBe(false);
  expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  expect(key(input, " ")).toBe(false);
  expect(key(input, "ArrowDown")).toBe(true);
  expect(key(input, "Enter")).toBe(true);
  expect(component.getValue()).toBe("ch");
  expect(component.getText()).toBe("Switzerland");
  expect(seen).toEqual(["ch", null]);
  expect(document.activeElement).toBe(input);
  expect(input.hasAttribute("aria-controls")).toBe(false);
  expect(key(input, "Escape")).toBe(true);
  expect(component.getText()).toBe("");
  expect(component.isOpen()).toBe(false);
});

test("free-solo blur commits text, while strict blur restores a selection or reports required", () => {
  const free = mount({ options: ["A"], emptyText: "Nothing" });
  free.input.focus();
  type(free.input, "other");
  free.input.blur();
  expect(free.component.getValue()).toBe("other");
  free.component.destroy();

  const strict = mount({ strict: true, required: true, value: "a", options: [{ value: "a", text: "A" }] });
  strict.input.focus();
  type(strict.input, "unmatched");
  strict.input.blur();
  expect(strict.component.getValue()).toBe("a");
  expect(strict.input.value).toBe("A");
  strict.component.clear();
  strict.input.focus();
  type(strict.input, "unmatched");
  strict.input.blur();
  expect(strict.component.getValue()).toBeNull();
  expect(strict.input.validity.valueMissing).toBe(true);
});

test("applies the arrow opening intent after async suggestions arrive", async () => {
  const { component, input, box } = mount({
    openOnFocus: false, autoHighlight: true, debounce: 0, source: async () => ["First", "Last"],
  });
  input.focus();
  expect(key(input, "ArrowDown", true)).toBe(true);
  await Promise.resolve();
  expect(component.isOpen()).toBe(true);
  expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  expect(key(input, "ArrowUp", true)).toBe(true);
  expect(component.isOpen()).toBe(false);
  expect(key(input, "ArrowUp")).toBe(true);
  await Promise.resolve();
  expect(input.getAttribute("aria-activedescendant")).toBe(rows(box)[1].id);
});

test("debounces async suggestions, aborts requests and ignores late results", async () => {
  const pending: Array<{ query: string; signal: AbortSignal; resolve(options: string[]): void }> = [];
  const { component, input, box } = mount({
    debounce: 8, filter: false, loadingText: "Loading options",
    source: (query, signal) => new Promise(resolve => pending.push({ query, signal, resolve })),
  });
  type(input, "a");
  type(input, "ab");
  await Bun.sleep(30);
  expect(pending.map(call => call.query)).toEqual(["ab"]);
  expect(input.getAttribute("aria-busy")).toBe("true");
  expect(box.textContent).toBe("Loading options");
  type(input, "abc");
  expect(pending[0].signal.aborted).toBe(true);
  await Bun.sleep(30);
  pending[1].resolve(["new result"]);
  pending[0].resolve(["stale result"]);
  await Promise.resolve();
  expect(box.textContent).toBe("new result");
  expect(input.hasAttribute("aria-busy")).toBe(false);
  type(input, "new");
  await Bun.sleep(30);
  component.destroy();
  expect(pending[2].signal.aborted).toBe(true);
});

test("updates rows in place and keeps option snapshots and native form values separate from labels", () => {
  const { component, input, box } = mount({ name: "country", options: [{ value: "us", text: "United States" }] });
  const form = document.createElement("form");
  form.append(component.element);
  document.body.append(form);
  input.focus();
  component.setOptions([{ value: "us", text: "United States" }, "Canada"]);
  expect(rows(box)).toHaveLength(2);
  expect(document.activeElement).toBe(input);
  component.setValue("us");
  expect(new window.FormData(form).get("country")).toBe("us");
  expect(input.value).toBe("United States");
  component.getSelectedOption()!.text = "Changed";
  expect(component.getSelectedOption()?.text).toBe("United States");
});
