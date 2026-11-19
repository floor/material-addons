import { expect, test } from "bun:test";
import { defineElement, registerStyles } from "material/elements";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

installAutocompleteDom();

test("Material's public element authoring contract supports addon lifecycle, attributes, events, slots and styles", async () => {
  registerStyles({ ripple: "/* required by Material */", "addon-contract": ".addon-contract{color:red}" });
  let notify: ((payload: string) => void) | undefined;
  let disconnected = false;
  const definition = defineElement({
    name: "addon-contract",
    styles: ["addon-contract"],
    attributes: { label: { type: "string", config: "label", update: (c, v) => { c.element.title = String(v); } } },
    slot: { attribute: "text", config: "text" },
    events: { select: { detail: value => ({ value }) } },
    create(config) {
      const element = document.createElement("div");
      element.className = "addon-contract";
      element.title = String(config.label);
      element.append(config.text as Node);
      return {
        element,
        on(_event: string, listener: (payload: string) => void) { notify = listener; },
        off() { notify = undefined; },
        destroy() { disconnected = true; },
      };
    },
  });
  const host = document.createElement(definition.define({ prefix: "probe" }));
  host.setAttribute("label", "Initial");
  host.setAttribute("text", "Fallback");
  document.body.append(host);
  const root = host.shadowRoot!;
  expect(root.querySelector(".addon-contract")?.getAttribute("title")).toBe("Initial");
  host.setAttribute("label", "Changed");
  expect(root.querySelector(".addon-contract")?.getAttribute("title")).toBe("Changed");
  expect(root.querySelector("slot")?.textContent).toBe("Fallback");
  expect(root.textContent).toContain(".addon-contract{color:red}");
  let selected: unknown;
  document.body.addEventListener("select", event => {
    selected = (event as CustomEvent).detail;
    expect(event.composed).toBe(true);
  });
  notify?.("a");
  expect(selected).toEqual({ value: "a" });
  host.remove();
  await Promise.resolve();
  expect(disconnected).toBe(true);
  expect(notify).toBeUndefined();
});
