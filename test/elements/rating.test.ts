import { expect, test } from "bun:test";
import "material/elements/css/ripple";
import { registerStyles } from "material/elements";
import { defineRating, ratingElement } from "../../src/elements/rating";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

installAutocompleteDom();

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
  const input = host.querySelector<HTMLInputElement>("input.mtrl-rating__input");
  expect(input?.parentElement).toBe(host);
  expect(input?.value).toBe("3.5");
  expect(new window.FormData(form).get("score")).toBe("3.5");

  const seen: Array<{ value: number; previousValue: number }> = [];
  host.addEventListener("change", ((event: CustomEvent<{ value: number; previousValue: number }>) => {
    seen.push(event.detail);
  }) as EventListener);
  group().querySelector<HTMLButtonElement>('[data-value="4"]')?.click();
  expect(seen).toEqual([{ value: 4, previousValue: 3.5 }]);
  expect(host.value).toBe(4);
  expect(input?.value).toBe("4");

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

  host.readOnly = true;
  expect(group().getAttribute("role")).toBe("img");
  expect(group().querySelectorAll("[role=radio]").length).toBe(0);
  host.remove();
});
