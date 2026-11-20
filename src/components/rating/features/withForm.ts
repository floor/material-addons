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
    const fieldValue = (value: number) => (value > 0 ? formatRating(value) : "");

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
      if (!input) return;
      input.value = fieldValue(view.state.value);
      input.disabled = view.state.disabled;
      if (resetDefault) input.defaultValue = fieldValue(view.state.initialValue);
    };

    const onReset = (event: Event) => {
      const form = event.target;
      const node = input?.isConnected ? input : component.element;
      if (!(form instanceof HTMLFormElement) || !form.contains(node)) return;
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
