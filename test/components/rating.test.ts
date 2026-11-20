import { describe, expect, test } from "bun:test";
import { createRating } from "../../src/components/rating";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

installAutocompleteDom();

function star(root: HTMLElement, index: number) {
  return root.querySelector<HTMLElement>(`.mtrl-rating__star[data-star="${index}"]`);
}

function stop(root: HTMLElement, value: string) {
  return root.querySelector<HTMLButtonElement>(`.mtrl-rating__stop[data-value="${value}"]`);
}

function press(target: Element, key: string) {
  target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("createRating", () => {
  test("defaults to an empty medium rating and clamps to the step", () => {
    const rating = createRating({ className: "owner", class: "extra" });
    const root = rating.element;
    expect(root.classList.contains("mtrl-rating")).toBe(true);
    expect(root.classList.contains("mtrl-rating--medium")).toBe(true);
    expect(root.classList.contains("owner")).toBe(true);
    expect(root.classList.contains("extra")).toBe(true);
    expect([rating.getValue(), rating.getMax(), rating.isHalf(), rating.isReadOnly(), rating.isDisabled(), rating.getSize()]).toEqual([0, 5, false, false, false, "medium"]);
    expect(root.querySelectorAll("[role=radio]").length).toBe(5);
    expect(stop(root, "1")?.tabIndex).toBe(0);

    rating.setValue(7);
    expect(rating.getValue()).toBe(5);
    rating.setValue(2.3);
    expect(rating.getValue()).toBe(2);
    rating.setHalf(true);
    rating.setValue(2.3);
    expect(rating.getValue()).toBe(2.5);
    expect(createRating({ precision: 0.5, value: 2.3 }).getValue()).toBe(2.5);
    expect(createRating({ half: true, precision: 1, value: 2.3 }).getValue()).toBe(2);
    expect(createRating({ max: 0, value: 3 }).getMax()).toBe(5);
    rating.destroy();
  });

  test("selects whole and half stars and clears on a second click", () => {
    const rating = createRating();
    const root = rating.element;
    const first = root.querySelector<HTMLInputElement>("input.mtrl-rating__stop");
    stop(root, "1")?.click();
    expect(first?.checked).toBe(true);
    stop(root, "4")?.click();
    expect(rating.getValue()).toBe(4);
    expect(first?.checked).toBe(false);
    expect(first?.getAttribute("aria-checked")).toBe("false");
    stop(root, "3")?.click();
    expect(rating.getValue()).toBe(3);
    expect(first?.checked).toBe(false);
    for (const index of [1, 2, 3]) expect(star(root, index)?.classList.contains("mtrl-rating__star--full")).toBe(true);
    for (const index of [4, 5]) expect(star(root, index)?.classList.contains("mtrl-rating__star--empty")).toBe(true);
    for (const button of root.querySelectorAll<HTMLButtonElement>(".mtrl-rating__stop")) {
      const selected = button.dataset.value === "3";
      expect(button.getAttribute("aria-checked")).toBe(selected ? "true" : "false");
      expect(button.tabIndex).toBe(selected ? 0 : -1);
    }

    const half = createRating({ half: true });
    stop(half.element, "3.5")?.click();
    expect(half.getValue()).toBe(3.5);
    for (const index of [1, 2, 3]) expect(star(half.element, index)?.classList.contains("mtrl-rating__star--full")).toBe(true);
    expect(star(half.element, 4)?.classList.contains("mtrl-rating__star--half")).toBe(true);
    expect(star(half.element, 5)?.classList.contains("mtrl-rating__star--empty")).toBe(true);
    expect(stop(half.element, "3.5")?.getAttribute("aria-checked")).toBe("true");
    expect(stop(half.element, "4")?.getAttribute("aria-checked")).toBe("false");

    stop(root, "3")?.click();
    expect(rating.getValue()).toBe(0);
    const kept = createRating({ value: 3, noClear: true });
    stop(kept.element, "3")?.click();
    expect(kept.getValue()).toBe(3);
    const required = createRating({ value: 3, required: true });
    stop(required.element, "3")?.click();
    expect(required.getValue()).toBe(3);
    rating.destroy();
    half.destroy();
    kept.destroy();
    required.destroy();
  });

  test("paints a read-only fraction and ignores input while disabled", () => {
    const rating = createRating({ readOnly: true, value: 3.5 });
    const group = rating.element.querySelector(".mtrl-rating__group");
    expect(group?.getAttribute("role")).toBe("img");
    expect(group?.getAttribute("aria-label")).toBe("3.5 of 5 stars");
    expect(rating.element.querySelectorAll("[role=radio]").length).toBe(0);
    const guest = createRating({ readOnly: true, value: 3.7, ariaLabel: "Guest rating" });
    expect(guest.element.querySelector(".mtrl-rating__group")?.getAttribute("aria-label")).toBe("Guest rating: 3.7 of 5 stars");
    const critic = createRating({ readOnly: true, value: 3.7, label: "Critic rating" });
    expect(critic.element.querySelector(".mtrl-rating__group")?.getAttribute("aria-label")).toBe("Critic rating: 3.7 of 5 stars");
    const fraction = createRating({ readOnly: true, value: 3.7 });
    expect(fraction.getValue()).toBe(3.7);
    expect(star(fraction.element, 4)?.classList.contains("mtrl-rating__star--fraction")).toBe(true);
    expect(star(fraction.element, 4)?.style.getPropertyValue("--_star-fill")).toBe("70%");

    const form = document.createElement("form");
    const disabled = createRating({ name: "score", value: 2, disabled: true });
    form.append(disabled.element);
    document.body.append(form);
    press(disabled.element.querySelector(".mtrl-rating__group")!, "ArrowRight");
    disabled.element.querySelector<HTMLButtonElement>(".mtrl-rating__stop")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(disabled.getValue()).toBe(2);
    expect(disabled.element.querySelector<HTMLInputElement>("input.mtrl-rating__input")?.disabled).toBe(true);
    expect(disabled.element.querySelector<HTMLInputElement>("input.mtrl-rating__stop")?.disabled).toBe(true);
    expect(disabled.element.querySelector(".mtrl-rating__validity")).toBeNull();
    expect(new window.FormData(form).get("score")).toBe(null);
    rating.destroy();
    guest.destroy();
    critic.destroy();
    fraction.destroy();
    disabled.destroy();
  });

  test("moves by arrow keys in both writing directions", () => {
    const rating = createRating({ value: 2 });
    const group = rating.element.querySelector<HTMLElement>(".mtrl-rating__group")!;
    press(group, "ArrowRight");
    expect(rating.getValue()).toBe(3);
    press(group, "ArrowUp");
    expect(rating.getValue()).toBe(4);
    press(group, "ArrowLeft");
    expect(rating.getValue()).toBe(3);
    press(group, "ArrowDown");
    expect(rating.getValue()).toBe(2);
    press(group, "Home");
    expect(rating.getValue()).toBe(1);
    press(group, "End");
    expect(rating.getValue()).toBe(5);
    press(group, "Backspace");
    expect(rating.getValue()).toBe(0);
    press(group, "ArrowRight");
    expect(rating.getValue()).toBe(1);
    press(stop(rating.element, "1")!, " ");
    expect(rating.getValue()).toBe(0);

    const stepped = createRating({ half: true, value: 2 });
    const steppedGroup = stepped.element.querySelector<HTMLElement>(".mtrl-rating__group")!;
    const steppedFirst = stepped.element.querySelector<HTMLInputElement>("input.mtrl-rating__stop")!;
    press(steppedGroup, "Home");
    expect(stepped.getValue()).toBe(0.5);
    expect(steppedFirst.checked).toBe(true);
    steppedFirst.click();
    expect(stepped.getValue()).toBe(0);
    expect(steppedFirst.checked).toBe(false);
    steppedFirst.click();
    expect(stepped.getValue()).toBe(0.5);
    press(steppedGroup, "ArrowUp");
    expect(stepped.getValue()).toBe(1);
    expect(steppedFirst.checked).toBe(false);
    stepped.destroy();

    const half = createRating({ half: true, value: 1 });
    const halfGroup = half.element.querySelector<HTMLElement>(".mtrl-rating__group")!;
    press(halfGroup, "ArrowRight");
    expect(half.getValue()).toBe(1.5);
    press(halfGroup, "Home");
    expect(half.getValue()).toBe(0.5);
    press(halfGroup, "Delete");
    expect(half.getValue()).toBe(0);
    const required = createRating({ half: true, required: true, value: 1 });
    press(required.element.querySelector(".mtrl-rating__group")!, "ArrowLeft");
    expect(required.getValue()).toBe(0.5);
    press(required.element.querySelector(".mtrl-rating__group")!, "0");
    expect(required.getValue()).toBe(0.5);

    const wrap = document.createElement("div");
    wrap.setAttribute("dir", "rtl");
    const rtl = createRating({ value: 2 });
    wrap.append(rtl.element);
    document.body.append(wrap);
    const rtlGroup = rtl.element.querySelector<HTMLElement>(".mtrl-rating__group")!;
    press(rtlGroup, "ArrowLeft");
    expect(rtl.getValue()).toBe(3);
    press(rtlGroup, "ArrowRight");
    expect(rtl.getValue()).toBe(2);
    rating.destroy();
    half.destroy();
    required.destroy();
    rtl.destroy();
  });

  test("submits the named score, restores the reset value, and reports a required miss", () => {
    const form = document.createElement("form");
    const rating = createRating({ name: "score", half: true, defaultValue: 1, value: 3.5 });
    form.append(rating.element);
    document.body.append(form);
    expect(rating.element.querySelector<HTMLInputElement>("input.mtrl-rating__input")?.value).toBe("3.5");
    expect([...new window.FormData(form).getAll("score")]).toEqual(["3.5"]);
    let changes = 0;
    rating.on("change", () => { changes += 1; });
    rating.setValue(4);
    expect(changes).toBe(1);
    expect([...new window.FormData(form).getAll("score")]).toEqual(["4"]);
    form.reset();
    expect(rating.getValue()).toBe(1);
    expect(changes).toBe(1);
    expect([...new window.FormData(form).getAll("score")]).toEqual(["1"]);
    rating.setValue(2);
    expect([...new window.FormData(form).getAll("score")]).toEqual(["2"]);

    const empty = createRating({ name: "score" });
    const emptyForm = document.createElement("form");
    emptyForm.append(empty.element);
    document.body.append(emptyForm);
    expect(new window.FormData(emptyForm).get("score")).toBe("");

    const requiredForm = document.createElement("form");
    const blocked = createRating({ name: "score", required: true, label: "Required" });
    const blockedSubmit = document.createElement("button");
    blockedSubmit.type = "submit";
    requiredForm.append(blocked.element, blockedSubmit);
    document.body.append(requiredForm);
    const gate = blocked.element.querySelector<HTMLInputElement>("input.mtrl-rating__stop");
    expect(gate).toBe(blocked.element.querySelector(".mtrl-rating__stop"));
    expect(blocked.element.querySelector(".mtrl-rating__group")?.contains(gate!)).toBe(true);
    expect(blocked.element.querySelector(".mtrl-rating__validity")).toBeNull();
    expect(gate?.name).toBe("");
    expect(gate?.validationMessage).toBe("Please select a rating.");
    expect(gate?.getAttribute("aria-label")).toBe("1 star");
    expect(requiredForm.checkValidity()).toBe(false);
    let submitted = 0;
    requiredForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitted += 1;
    });
    blockedSubmit.click();
    expect(submitted).toBe(0);
    expect([...new window.FormData(requiredForm).keys()]).toEqual(["score"]);
    blocked.setValue(2);
    expect(gate?.validationMessage).toBe("");
    expect(requiredForm.checkValidity()).toBe(true);
    expect(new window.FormData(requiredForm).get("score")).toBe("2");
    blockedSubmit.click();
    expect(submitted).toBe(1);

    const required = createRating({ required: true, label: "Quality" });
    expect(required.checkValidity()).toBe(false);
    expect(required.reportValidity()).toBe(false);
    expect(required.isError()).toBe(true);
    expect(required.element.querySelector(".mtrl-rating__group")?.getAttribute("aria-invalid")).toBe("true");
    expect(required.element.classList.contains("mtrl-rating--error")).toBe(true);
    required.setValue(2);
    expect(required.isError()).toBe(false);
    required.setError(true);
    required.setValue(4);
    expect(required.isError()).toBe(true);
    required.setError(false);
    expect(required.isError()).toBe(false);

    const preview = createRating({ value: 1, showValue: true });
    const hovered = stop(preview.element, "4")!;
    hovered.dispatchEvent(new window.Event("pointerenter"));
    expect(preview.getValue()).toBe(1);
    expect(preview.element.querySelector(".mtrl-rating__value")?.textContent).toBe("4");
    expect(stop(preview.element, "1")?.getAttribute("aria-checked")).toBe("true");
    preview.element.querySelector(".mtrl-rating__group")?.dispatchEvent(new window.Event("pointerleave"));
    expect(preview.element.querySelector(".mtrl-rating__value")?.textContent).toBe("1");
    expect(stop(preview.element, "1")?.getAttribute("aria-label")).toBe("1 star");
    expect(stop(preview.element, "4")?.getAttribute("aria-label")).toBe("4 stars");
    rating.destroy();
    empty.destroy();
    blocked.destroy();
    required.destroy();
    preview.destroy();
  });
});
