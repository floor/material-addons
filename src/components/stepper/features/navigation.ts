// src/components/stepper/features/navigation.ts

import { STEPPER_ACTIONS, STEPPER_CLASSES, STEPPER_EVENTS } from "../constants";
import type { StepperSettings } from "../config";
import { activeValueOf, canReach, createStepState, indexOfValue } from "../config";
import type {
  StepConfig,
  StepValidationContext,
  StepValidationResult,
  StepValidator,
  StepState,
  StepperBeforeChangeEvent,
  StepperChangeEvent,
  StepperCompleteEvent,
  StepperErrorEvent,
  StepperResetEvent,
} from "../types";
import { queryPanel, type Renderer, type StepperHost } from "./renderer";

/** What navigation, rendering and the API share */
export interface StepperContext {
  settings: StepperSettings;
  renderer: Renderer;
  declarations: StepConfig[];
  steps: StepState[];
  validating: boolean;
  resolved: () => "horizontal" | "vertical";
  component: StepperHost & { config?: StepperSettings };
}

const resolveTarget = (steps: StepState[], target: number | string): number => {
  if (typeof target === "number") return target;
  return indexOfValue(steps, target);
};

/** Stage 1 of the pipeline: native constraint validation across the panel's forms and controls */
const nativeValid = (panel: HTMLElement | null, report: boolean): boolean => {
  if (!panel) return true;
  const controls = queryPanel<HTMLElement>(
    panel,
    "form, input, select, textarea, [data-mtrl-form-control]",
  ).filter((control) => typeof (control as HTMLFormElement).checkValidity === "function");
  for (const control of controls) {
    const check = control as HTMLFormElement;
    const valid = check.checkValidity();
    if (!valid) {
      if (report && typeof check.reportValidity === "function") check.reportValidity();
      return false;
    }
  }
  return true;
};

/** What this navigation layer exposes to the API */
export interface Navigation {
  getValue: () => string | null;
  setValue: (value: string | null) => boolean;
  next: () => Promise<boolean>;
  prev: () => Promise<boolean>;
  goTo: (target: number | string) => Promise<boolean>;
  reset: () => void;
  validate: (target?: number | string) => Promise<boolean>;
  completeStep: (target?: number | string, completed?: boolean) => void;
  setError: (target: number | string, error: boolean, supportingText?: string) => void;
  setStepState: (target: number | string, patch: Partial<StepConfig>) => void;
  setSteps: (steps: StepConfig[]) => void;
  addStep: (step: StepConfig, index?: number) => void;
  removeStep: (target: number | string) => void;
  setLinear: (linear: boolean) => void;
  getPanelElement: (target: number | string) => HTMLElement | null;
  getHeaderElement: (target: number | string) => HTMLButtonElement | null;
  getActiveIndex: () => number;
  destroy: () => void;
}

export const withNavigation = (
  ctx: StepperContext,
  component: StepperHost & { config: StepperSettings },
): Navigation => {
  const { settings, renderer } = ctx;
  let destroyed = false;

  const sync = (): void => {
    renderer.sync(ctx.steps, ctx.resolved());
  };

  const activeIndex = (): number => ctx.steps.findIndex((step) => step.active);

  const live = (step: StepState): void => {
    renderer.live.textContent = `Step ${step.index + 1} of ${ctx.steps.length}: ${step.label}`;
  };

  /** The whole stepper is off: configured so, or disabled since creation */
  // withDisabled sets the aria state at creation and on every enable()/disable(),
  // so it is the one record: the configured `disabled` is only its start
  const off = (): boolean => component.element.getAttribute("aria-disabled") === "true";

  const cls = (name: string): string => component.getClass(name);

  /** The configured callbacks for the events they shadow */
  const callbacks: Record<string, ((event: never) => void) | undefined> = {
    [STEPPER_EVENTS.CHANGE]: settings.onChange,
    [STEPPER_EVENTS.COMPLETE]: settings.onComplete,
    [STEPPER_EVENTS.ERROR]: settings.onError,
    [STEPPER_EVENTS.RESET]: settings.onReset,
  };

  /** The configured callback for an event, beside the DOM event */
  const emit = <T>(name: string, payload: T): T => {
    component.emit(name, payload as unknown as Record<string, unknown>);
    (callbacks[name] as ((event: T) => void) | undefined)?.(payload);
    return payload;
  };

  /** The vetoable event: the factory form carries preventDefault and defaultPrevented */
  const askBeforeChange = (
    from: StepState | null,
    to: StepState,
    direction: "forward" | "backward",
  ): StepperBeforeChangeEvent => {
    const payload: StepperBeforeChangeEvent = {
      previousValue: from?.value ?? null,
      value: to.value,
      previousStep: from,
      step: to,
      direction,
      preventDefault: () => {
        (payload as { defaultPrevented: boolean }).defaultPrevented = true;
      },
      defaultPrevented: false,
    };
    component.emit(STEPPER_EVENTS.BEFORE_CHANGE, payload as unknown as Record<string, unknown>);
    settings.onBeforeChange?.(payload);
    return payload;
  };

  /** Runs Stage 1 and Stage 2 for a step; returns whether it may be left */
  const runValidation = async (index: number, targetValue: string | null): Promise<{ valid: boolean; supportingText?: string }> => {
    const step = ctx.steps[index];
    if (!step) return { valid: true };
    const declaration = ctx.declarations[index];
    const panel = ctx.renderer.panelElements[index] ?? null;
    if (!nativeValid(panel, settings.reportValidity)) return { valid: false };

    // The step's own validator first, then the stepper's, both required (§6)
    const validators = [declaration?.validate, settings.validate].filter(
      (candidate): candidate is StepValidator => typeof candidate === "function",
    );
    if (!validators.length) return { valid: true };

    const context: StepValidationContext = {
      value: step.value,
      targetValue,
      direction: targetValue === null ? "none" : "forward",
      panel,
      stepper: component as unknown as StepperContext["component"] as never,
    };

    const apply = (result: boolean | StepValidationResult): { valid: boolean; supportingText?: string } =>
      typeof result === "boolean" ? { valid: result } : { valid: result.valid, supportingText: result.supportingText };

    for (const validator of validators) {
      let outcome: boolean | StepValidationResult | Promise<boolean | StepValidationResult>;
      try {
        outcome = validator({ ...step }, context);
      } catch (error) {
        return { valid: false, supportingText: error instanceof Error ? error.message : undefined };
      }
      if (outcome instanceof Promise) {
        ctx.validating = true;
        step.validating = true;
        sync();
        try {
          outcome = apply(await outcome);
        } catch (error) {
          return { valid: false, supportingText: error instanceof Error ? error.message : undefined };
        } finally {
          ctx.validating = false;
          step.validating = false;
          sync();
        }
      }
      const settled = apply(outcome);
      if (!settled.valid) return settled;
    }
    return { valid: true };
  };

  /** The copy the author declared for a step: what an error copy goes back to */
  const restoreSupportingText = (index: number): void => {
    const step = ctx.steps[index];
    const declaration = ctx.declarations[index];
    if (step && declaration) step.supportingText = declaration.supportingText;
  };

  /** Marks a step invalid, with the copy its supporting line shows */
  const markError = (index: number, supportingText?: string): void => {
    const step = ctx.steps[index];
    step.error = true;
    step.completed = false;
    if (supportingText !== undefined) step.supportingText = supportingText;
  };

  const emitComplete = (step: StepState): void => {
    emit<StepperCompleteEvent>(STEPPER_EVENTS.COMPLETE, {
      value: step.value,
      steps: ctx.steps.map((candidate) => ({ ...candidate })),
    });
  };

  const emitError = (index: number): void => {
    const step = ctx.steps[index];
    emit<StepperErrorEvent>(STEPPER_EVENTS.ERROR, {
      value: step.value,
      step: { ...step },
      supportingText: step.error ? step.supportingText : undefined,
    });
  };

  /** The one place a failed validation is shown */
  const fail = (index: number, supportingText?: string): void => {
    markError(index, supportingText);
    sync();
    emitError(index);
  };

  /** The one place the active step changes */
  const commit = async (index: number): Promise<boolean> => {
    if (off()) return false;
    const from = activeIndex();
    if (from === index) return false;
    const fromStep = from >= 0 ? ctx.steps[from] : null;
    const target = ctx.steps[index];
    if (!target || target.disabled) return false;
    const direction = from >= 0 && index < from ? "backward" : "forward";
    // Held before validation runs: a cancel puts an automatic completion back
    const completedBefore = fromStep?.completed ?? false;

    if (from >= 0 && fromStep && direction === "forward") {
      const shouldValidate = settings.linear || settings.validateOnForward;
      if (shouldValidate) {
        const result = await runValidation(from, target.value);
        if (!result.valid) {
          fail(from, result.supportingText);
          if (settings.linear) return false;
        } else {
          fromStep.error = false;
          restoreSupportingText(from);
          fromStep.completed = true;
        }
      }
    }

    const before = askBeforeChange(fromStep, target, direction);
    if (before.defaultPrevented) {
      // The transition did not happen: an automatic completion goes back too
      if (fromStep) {
        fromStep.completed = completedBefore;
        sync();
      }
      return false;
    }

    if (fromStep) fromStep.active = false;
    target.active = true;
    sync();
    live(target);
    emit<StepperChangeEvent>(STEPPER_EVENTS.CHANGE, {
      value: target.value,
      previousValue: fromStep?.value ?? null,
      step: { ...target },
      previousStep: fromStep ? { ...fromStep } : null,
      direction,
    });

    const last = ctx.steps.length - 1;
    const allDone = ctx.steps
      .slice(0, -1)
      .every((step) => step.completed || step.optional);
    if (index === last && (target.completed || allDone)) emitComplete(target);
    return true;
  };

  /** The guard that decides whether a move is possible at all */
  const allowed = (index: number): boolean =>
    !ctx.validating && !off() && canReach(ctx.steps, index, settings.linear);

  const goTo = async (target: number | string): Promise<boolean> => {
    if (destroyed) return false;
    const index = resolveTarget(ctx.steps, target);
    if (!allowed(index)) return false;
    return commit(index);
  };

  /** `next()` on the last step: validation, then completion, no move */
  const finish = async (index: number): Promise<boolean> => {
    const result = await runValidation(index, null);
    const step = ctx.steps[index]!;
    if (!result.valid) {
      fail(index, result.supportingText);
      return false;
    }
    step.error = false;
    restoreSupportingText(index);
    step.completed = true;
    sync();
    emitComplete(step);
    return true;
  };

  const next = async (): Promise<boolean> => {
    const from = activeIndex();
    if (from < 0 || off() || ctx.validating) return false;
    if (from === ctx.steps.length - 1) return finish(from);
    // The next enabled step only: a veto or a guard on it does not fall through
    // to a later one
    for (let index = from + 1; index < ctx.steps.length; index++) {
      if (ctx.steps[index]?.disabled) continue;
      return goTo(index);
    }
    return false;
  };

  const prev = async (): Promise<boolean> => {
    const from = activeIndex();
    for (let index = from - 1; index >= 0; index--) {
      if (ctx.steps[index]?.disabled) continue;
      return goTo(index);
    }
    return false;
  };

  const validate = async (target?: number | string): Promise<boolean> => {
    const index = target === undefined ? activeIndex() : resolveTarget(ctx.steps, target);
    const result = await runValidation(index, null);
    const step = ctx.steps[index];
    if (!step) return result.valid;
    if (result.valid) {
      step.error = false;
      restoreSupportingText(index);
    } else {
      fail(index, result.supportingText);
    }
    sync();
    return result.valid;
  };

  const reset = (): void => {
    const from = activeIndex();
    const headers = renderer.headers;
    headers.forEach((_header, index) => {
      const body = renderer.bodies[index] ?? null;
      queryPanel<HTMLFormElement>(body, "form").forEach((form) => form.reset());
      const step = ctx.steps[index];
      step.completed = false;
      step.error = false;
      restoreSupportingText(index);
    });
    const first = ctx.steps.findIndex((step) => !step.disabled);
    ctx.steps.forEach((step, index) => {
      step.active = index === first;
    });
    sync();
    emit<StepperResetEvent>(STEPPER_EVENTS.RESET, {
      value: first >= 0 ? ctx.steps[first].value : null,
      previousValue: from >= 0 ? ctx.steps[from].value : null,
    });
  };

  const completeStep = (target?: number | string, completed = true): void => {
    const index = target === undefined ? activeIndex() : resolveTarget(ctx.steps, target);
    const step = ctx.steps[index];
    if (!step) return;
    step.completed = completed;
    if (completed) step.error = false;
    sync();
  };

  const setError = (target: number | string, error: boolean, supportingText?: string): void => {
    const index = resolveTarget(ctx.steps, target);
    const step = ctx.steps[index];
    if (!step) return;
    step.error = error;
    if (supportingText !== undefined) step.supportingText = supportingText;
    sync();
  };

  const setStepState = (target: number | string, patch: Partial<StepConfig>): void => {
    const index = resolveTarget(ctx.steps, target);
    const step = ctx.steps[index];
    if (!step) return;
    if (patch.label !== undefined) step.label = patch.label;
    if (patch.supportingText !== undefined) step.supportingText = patch.supportingText;
    if (patch.icon !== undefined) step.icon = patch.icon;
    if (patch.completed !== undefined) step.completed = patch.completed;
    if (patch.editable !== undefined) step.editable = patch.editable;
    if (patch.optional !== undefined) step.optional = patch.optional;
    if (patch.error !== undefined) step.error = patch.error;
    if (patch.disabled !== undefined) step.disabled = patch.disabled;
    const declaration = ctx.declarations[index];
    if (declaration) Object.assign(declaration, patch);
    // Labels and icons are rendered nodes, not just state: draw the list again
    renderer.render(ctx.steps, ctx.declarations.map((declaration) => declaration.content));
    sync();
  };

  const setSteps = (steps: StepConfig[]): void => {
    const previous = activeValueOf(ctx.steps);
    ctx.declarations = steps;
    const states = steps.map(createStepState);
    // The selection survives a declaration update: the same value stays active
    const kept = previous === null ? -1 : indexOfValue(states, previous);
    // The same rule as creation: an eligible kept value, else the first enabled
    // step, else none at all
    const chosen = kept >= 0 && !states[kept]?.disabled
      ? kept
      : states.findIndex((state) => !state.disabled);
    if (chosen >= 0) states[chosen]!.active = true;
    // The list is shared with every reader (the API holds the same array)
    ctx.steps.splice(0, ctx.steps.length, ...states);
    renderer.render(ctx.steps, steps.map((declaration) => declaration.content));
    sync();
  };

  const addStep = (step: StepConfig, index?: number): void => {
    const at = index === undefined ? ctx.declarations.length : Math.max(0, Math.min(index, ctx.declarations.length));
    ctx.declarations = [...ctx.declarations.slice(0, at), step, ...ctx.declarations.slice(at)];
    setSteps(ctx.declarations);
  };

  const removeStep = (target: number | string): void => {
    const index = resolveTarget(ctx.steps, target);
    if (index < 0) return;
    ctx.declarations = ctx.declarations.filter((_step, i) => i !== index);
    setSteps(ctx.declarations);
  };

  /**
   * Focus where the next step's work starts, after a panel action moved.
   * "panel": the first eligible control, then the panel itself; "heading": the
   * panel's heading, then the same. Header navigation never calls this: focus
   * stays on the header it was on.
   */
  const focusPanel = (): void => {
    const panel = renderer.panelElements[activeIndex()];
    if (!panel) return;
    const heading = queryPanel<HTMLElement>(panel, "h1, h2, h3, h4, h5, h6, [role='heading']")[0];
    const control = queryPanel<HTMLElement>(
      panel,
      "input, select, textarea, button, [href], [tabindex]",
    ).find((candidate) => !candidate.hasAttribute("disabled") && !candidate.closest("[hidden]"));
    const target =
      settings.focusOnAction === "heading" ? heading ?? control : control;
    if (target) {
      // A heading is not focusable on its own: give it a temporary tab stop
      if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    else {
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });
    }
  };

  const afterAction = (moved: Promise<boolean>): void => {
    void moved.then((did) => {
      if (did && settings.focusOnAction !== "none") focusPanel();
    });
  };

  const onActionClick = (event: MouseEvent): void => {
    // The composed path spans the light and shadow trees, so a header inside
    // the shadow and an action button slotted from a step both resolve here
    const path = event.composedPath();
    for (const node of path) {
      if (node instanceof HTMLElement && node.classList.contains(cls(STEPPER_CLASSES.HEADER))) {
        const index = Number(node.dataset.stepIndex);
        void goTo(Number.isInteger(index) ? index : 0);
        return;
      }
    }
    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.hasAttribute(STEPPER_ACTIONS.NEXT)) return afterAction(next());
      if (node.hasAttribute(STEPPER_ACTIONS.PREV)) return afterAction(prev());
      if (node.hasAttribute(STEPPER_ACTIONS.RESET)) return reset();
      if (node.hasAttribute(STEPPER_ACTIONS.GOTO)) {
        const raw = node.getAttribute(STEPPER_ACTIONS.GOTO) ?? "";
        const asIndex = Number(raw);
        return afterAction(goTo(Number.isInteger(asIndex) ? asIndex : raw));
      }
    }
  };

  component.element.addEventListener("click", onActionClick);

  return {
    getValue: () => activeValueOf(ctx.steps),
    // Silent, as a model setter: no validation, no change, no veto
    setValue: (value: string | null): boolean => {
      const index = value === null
        ? ctx.steps.findIndex((step) => !step.disabled)
        : indexOfValue(ctx.steps, value);
      const target = ctx.steps[index];
      if (!target || target.disabled) return false;
      ctx.steps.forEach((step) => {
        step.active = step === target;
      });
      sync();
      live(target);
      return true;
    },
    next,
    prev,
    goTo,
    reset,
    validate,
    completeStep,
    setError,
    setStepState,
    setSteps,
    addStep,
    removeStep,
    setLinear: (linear: boolean) => {
      settings.linear = linear;
      sync();
    },
    getPanelElement: (target: number | string) => {
      const index = resolveTarget(ctx.steps, target);
      return renderer.panelElements[index] ?? null;
    },
    getHeaderElement: (target: number | string) => {
      const index = resolveTarget(ctx.steps, target);
      return renderer.headers[index] ?? null;
    },
    getActiveIndex: activeIndex,
    destroy: () => {
      destroyed = true;
      component.element.removeEventListener("click", onActionClick);
    },
  };
};
