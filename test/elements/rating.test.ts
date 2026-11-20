import { beforeEach, expect, test } from "bun:test";
import "material/elements/css/ripple";
import { registerStyles } from "material/elements";
import { defineRating, ratingElement } from "../../src/elements/rating";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

installAutocompleteDom();

// jsdom ElementInternals has neither setFormValue nor setValidity. Record the
// call the element makes so a required miss can be asserted without a browser.
const validityRecords = new WeakMap<HTMLElement, { flags: ValidityStateFlags; message?: string; anchor?: HTMLElement }>();
const formValues = new WeakMap<HTMLElement, string>();

function scoreEntries(form: HTMLFormElement) {
  const native = [...new window.FormData(form).getAll("score")].map(String);
  const submitted = [...form.querySelectorAll("m-rating")].flatMap((host) => {
    const value = formValues.get(host);
    return value == null ? [] : [value];
  });
  return [...native, ...submitted];
}

beforeEach(() => {
  const prototype = HTMLElement.prototype as HTMLElement & { attachInternals?: () => ElementInternals };
  const original = prototype.attachInternals;
  if (!original) return;
  prototype.attachInternals = function (this: HTMLElement) {
    const internals = original.call(this);
    internals.setFormValue = (value) => {
      formValues.set(this, value == null ? "" : String(value));
    };
    internals.setValidity = (flags, message, anchor) => {
      validityRecords.set(this, { flags, message, anchor: anchor ?? undefined });
    };
    return internals;
  };
});

test("client rating submits its named value and validates a required miss", async () => {
  registerStyles({ rating: ".mtrl-rating{display:inline-flex}" });
  expect(ratingElement.spec.ssr).toBe(false);
  defineRating();
  const form = document.createElement("form");
  form.innerHTML = '<m-rating name="score" value="3.5" max="5" half label="Quality" required></m-rating>';
  document.body.append(form);
  const host = form.querySelector("m-rating")!;
  await Promise.resolve();
  const root = () => host.shadowRoot!.querySelector<HTMLElement>(".mtrl-rating")!;
  const group = () => root().querySelector<HTMLElement>(".mtrl-rating__group")!;
  expect(root().classList.contains("mtrl-rating--medium")).toBe(true);
  expect(group().getAttribute("role")).toBe("radiogroup");
  expect(host.value).toBe(3.5);
  expect(host.querySelector("input.mtrl-rating__input")).toBeNull();
  expect(host.shadowRoot!.querySelectorAll("[name]").length).toBe(0);
  expect(scoreEntries(form)).toEqual(["3.5"]);

  const seen: Array<{ value: number; previousValue: number }> = [];
  host.addEventListener("change", ((event: CustomEvent<{ value: number; previousValue: number }>) => {
    seen.push(event.detail);
  }) as EventListener);
  group().querySelector<HTMLButtonElement>('[data-value="4"]')?.click();
  expect(seen).toEqual([{ value: 4, previousValue: 3.5 }]);
  expect(host.value).toBe(4);
  expect(scoreEntries(form)).toEqual(["4"]);

  let hovers: Array<number | null> = [];
  host.addEventListener("hover", ((event: CustomEvent<{ value: number | null }>) => {
    hovers.push(event.detail.value);
  }) as EventListener);
  group().querySelector<HTMLButtonElement>('[data-value="2"]')?.dispatchEvent(new window.Event("pointerenter"));
  expect(hovers).toEqual([2]);
  expect(host.value).toBe(4);

  host.value = 0;
  expect(host.checkValidity()).toBe(false);
  expect(host.reportValidity()).toBe(false);
  expect(root().classList.contains("mtrl-rating--error")).toBe(true);
  expect(group().getAttribute("aria-invalid")).toBe("true");
  const missed = validityRecords.get(host);
  const anchor = host.shadowRoot!.querySelector<HTMLElement>(".mtrl-rating__stop");
  expect(missed?.flags.valueMissing).toBe(true);
  expect(missed?.message).toBe("Please select a rating.");
  expect(missed?.anchor).toBe(anchor);
  expect(anchor?.tabIndex).toBe(0);

  const blockedForm = document.createElement("form");
  blockedForm.innerHTML = '<m-rating name="score" required label="Required"></m-rating>';
  document.body.append(blockedForm);
  const blocked = blockedForm.querySelector("m-rating")!;
  await Promise.resolve();
  const blockedAnchor = blocked.shadowRoot!.querySelector<HTMLElement>(".mtrl-rating__stop");
  const blockedRecord = validityRecords.get(blocked);
  expect(blockedRecord?.flags.valueMissing).toBe(true);
  expect(blockedRecord?.anchor).toBe(blockedAnchor);
  blocked.value = 2;
  expect(validityRecords.get(blocked)?.flags.valueMissing).toBeUndefined();

  const scoreForm = document.createElement("form");
  scoreForm.innerHTML = '<m-rating name="score" value="1" half required></m-rating>';
  document.body.append(scoreForm);
  const scored = scoreForm.querySelector("m-rating")!;
  await Promise.resolve();
  expect(scoreEntries(scoreForm)).toEqual(["1"]);
  scored.value = 3.5;
  expect(scoreEntries(scoreForm)).toEqual(["3.5"]);
  expect(scored.querySelectorAll("[name]").length).toBe(0);
  expect(scored.shadowRoot!.querySelectorAll("[name]").length).toBe(0);
  (scored as HTMLElement & { formResetCallback(): void }).formResetCallback();
  expect(scored.value).toBe(1);
  expect(scoreEntries(scoreForm)).toEqual(["1"]);
  scored.value = 2;
  expect(scoreEntries(scoreForm)).toEqual(["2"]);

  const guest = document.createElement("m-rating");
  guest.setAttribute("read-only", "");
  guest.setAttribute("value", "3.7");
  guest.setAttribute("aria-label", "Guest rating");
  document.body.append(guest);
  await Promise.resolve();
  expect(guest.shadowRoot!.querySelector(".mtrl-rating__group")?.getAttribute("aria-label")).toBe("Guest rating: 3.7 of 5 stars");
  const critic = document.createElement("m-rating");
  critic.setAttribute("read-only", "");
  critic.setAttribute("value", "3.7");
  critic.setAttribute("label", "Critic rating");
  document.body.append(critic);
  await Promise.resolve();
  expect(critic.shadowRoot!.querySelector(".mtrl-rating__group")?.getAttribute("aria-label")).toBe("Critic rating: 3.7 of 5 stars");

  const halfHost = document.createElement("m-rating");
  halfHost.setAttribute("half", "");
  halfHost.setAttribute("value", "2");
  document.body.append(halfHost);
  await Promise.resolve();
  const halfGroup = halfHost.shadowRoot!.querySelector<HTMLElement>(".mtrl-rating__group")!;
  const halfFirst = halfHost.shadowRoot!.querySelector<HTMLInputElement>("input.mtrl-rating__stop")!;
  const key = (name: string) => halfGroup.dispatchEvent(new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
  key("Home");
  expect(halfHost.value).toBe(0.5);
  expect(halfFirst.checked).toBe(true);
  // Chromium sets the clicked radio checked after listeners return.
  halfFirst.addEventListener("click", () => {
    halfFirst.checked = true;
  }, { once: true });
  halfFirst.click();
  await Promise.resolve();
  expect(halfHost.value).toBe(0);
  expect(halfFirst.checked).toBe(false);
  halfFirst.click();
  expect(halfHost.value).toBe(0.5);
  key("ArrowUp");
  expect(halfHost.value).toBe(1);
  expect(halfFirst.checked).toBe(false);

  host.readOnly = true;
  expect(group().getAttribute("role")).toBe("img");
  expect(group().querySelectorAll("[role=radio]").length).toBe(0);
  host.remove();
});
