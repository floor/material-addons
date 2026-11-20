import { RATING_CLASSES } from "../constants";
import { formatRating } from "../config";
import type { RatingView } from "./withStars";

interface Host {
  element: HTMLElement;
  view: RatingView;
}

export function withForm() {
  return <T extends Host>(component: T): T => {
    const { view } = component;
    let input: HTMLInputElement | undefined;
    let gate: HTMLInputElement | undefined;
    const fieldValue = (value: number) => (value > 0 ? formatRating(value) : "");
    // A hidden input is barred from constraint validation. This unnamed radio
    // is what stops a native form from submitting an empty required rating.
    const syncGate = () => {
      if (!gate) {
        gate = component.element.ownerDocument.createElement("input");
        gate.type = "radio";
        gate.className = RATING_CLASSES.VALIDITY;
        gate.tabIndex = -1;
        gate.setAttribute("aria-hidden", "true");
        component.element.prepend(gate);
      }
      const missing = view.state.required && !view.state.disabled && view.state.value === 0;
      gate.disabled = view.state.disabled;
      gate.required = missing;
      gate.checked = view.state.value > 0;
      gate.setCustomValidity(missing ? "Please select a rating." : "");
    };

    const ensure = () => {
      const name = view.state.name;
      if (!name) {
        input?.remove();
        input = undefined;
        return;
      }
      let created = false;
      if (!input) {
        input = component.element.ownerDocument.createElement("input");
        input.type = "hidden";
        input.className = RATING_CLASSES.INPUT;
        component.element.append(input);
        created = true;
      }
      input.name = name;
      if (created) input.defaultValue = fieldValue(view.state.initialValue);
    };

    view.syncField = (resetDefault = false) => {
      ensure();
      syncGate();
      if (!input) return;
      // A hidden input stores its submitted value in the value attribute.
      // defaultValue writes that same attribute, so the live value is last.
      if (resetDefault) input.defaultValue = fieldValue(view.state.initialValue);
      input.value = fieldValue(view.state.value);
      input.disabled = view.state.disabled;
    };

    const onReset = (event: Event) => {
      const form = event.target;
      const FormElement = component.element.ownerDocument.defaultView?.HTMLFormElement;
      const node = input?.isConnected ? input : component.element;
      if (!FormElement || !(form instanceof FormElement) || !form.contains(node)) return;
      view.handleCommit(view.state.initialValue, undefined, true);
      view.syncField(true);
    };

    const window = component.element.ownerDocument.defaultView;
    window?.addEventListener("reset", onReset, true);
    view.cleanups.push(() => window?.removeEventListener("reset", onReset, true));
    view.syncField(true);
    return component;
  };
}
