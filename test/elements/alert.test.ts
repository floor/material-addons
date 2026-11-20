import { expect, test } from "bun:test";
import "material/elements/css/ripple";
import { registerStyles } from "material/elements";
import { alertElement, defineAlert } from "../../src/elements/alert";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

installAutocompleteDom();

test("<m-alert> reflects attributes, slots body content, and dispatches cancelable beforedismiss", async () => {
  registerStyles({ alert: ".mtrl-alert{display:flex}" });
  expect(alertElement.spec.ssr).toBe(false);
  defineAlert();

  document.body.innerHTML = `
    <m-alert severity="warning" variant="outlined" label="Storage almost full" action="Upgrade" dismissible>
      <span>You have used 95% of your quota.</span>
    </m-alert>
  `;
  const host = document.querySelector("m-alert")!;
  const root = () => host.shadowRoot!.querySelector<HTMLElement>(".mtrl-alert")!;
  await Promise.resolve();

  expect(root().getAttribute("part")).toBe("alert");
  expect(root().getAttribute("role")).toBe("alert");
  expect(root().classList.contains("mtrl-alert--warning")).toBe(true);
  expect(root().classList.contains("mtrl-alert--outlined")).toBe(true);
  expect(root().classList.contains("mtrl-alert--multiline")).toBe(true);

  const actionEvents: string[] = [];
  host.addEventListener("action", (event) => {
    actionEvents.push(event.detail.severity);
  });
  root().querySelector<HTMLButtonElement>(".mtrl-alert__action")!.click();
  expect(actionEvents).toEqual(["warning"]);

  let blockDismiss = true;
  const dismissEvents: string[] = [];
  host.addEventListener("beforedismiss", (event) => {
    if (blockDismiss) event.preventDefault();
  });
  host.addEventListener("dismiss", (event) => {
    dismissEvents.push(`${event.detail.severity}:${event.detail.reason}`);
  });

  root().querySelector<HTMLButtonElement>(".mtrl-alert__dismiss")!.click();
  expect(host.open).toBe(true);
  expect(host.hasAttribute("no-open")).toBe(false);
  expect(dismissEvents).toEqual([]);

  blockDismiss = false;
  root().querySelector<HTMLButtonElement>(".mtrl-alert__dismiss")!.click();
  expect(host.open).toBe(false);
  expect(host.hasAttribute("no-open")).toBe(true);
  expect(host.hasAttribute("hidden")).toBe(true);
  expect(dismissEvents).toEqual(["warning:button"]);

  host.open = true;
  expect(host.open).toBe(true);
  expect(host.hasAttribute("no-open")).toBe(false);
  expect(host.hasAttribute("hidden")).toBe(false);

  host.severity = "success";
  expect(root().getAttribute("role")).toBe("status");
  host.remove();
});
