// src/components/stepper/features/navigation.ts

import { STEPPER_ACTIONS, STEPPER_EVENTS } from "../constants";
import type { StepperSettings } from "../config";
import { activeValueOf, createStepState } from "../config";
import type {
  StepConfig,
  StepValidationContext,
  StepValidationResult,
  StepState,
  StepperBeforeChangeEvent,
  StepperChangeEvent,
  StepperCompleteEvent,
  StepperErrorEvent,
  StepperResetEvent,
} from "../types";
import type { Renderer, StepperHost } from "./renderer";

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

const indexOfValue = (steps: StepState[], value: string): number =>
  steps.findIndex((step) => step.value === value);

const resolveTarget = (steps: StepState[], target: number | string): number => {
  if (typeof target === "number") return target;
  return indexOfValue(steps, target);
};

/** Stage 1 of the pipeline: native constraint validation across the panel's forms and controls */
const nativeValid = (panel: HTMLElement | null, report: boolean): boolean => {
  if (!panel) return true;
  const controls = [
    ...Array.from(panel.querySelectorAll<HTMLFormElement>("form")),
    ...Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea, [data-mtrl-form-control]",
    )),
  ].filter((control) => typeof (control as HTMLFormElement).checkValidity === "function");
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
  setValue: (value: string | null) => Promise<boolean>;
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
  focusedIndex: () => number;
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

  const emit = <T>(name: string, payload: T): T => {
    component.emit(name, payload as unknown as Record<string, unknown>);
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
    const panel = ctx.renderer.bodies[index]?.parentElement?.parentElement as HTMLElement | null;
    if (!nativeValid(panel, settings.reportValidity)) return { valid: false };

    const validator = declaration?.validate ?? settings.validate;
    if (!validator) return { valid: true };

    const context: StepValidationContext = {
      value: step.value,
      targetValue,
      direction: targetValue === null ? "none" : "forward",
      panel,
      stepper: component as unknown as StepperContext["component"] as never,
    };

    const apply = (result: boolean | StepValidationResult): { valid: boolean; supportingText?: string } =>
      typeof result === "boolean" ? { valid: result } : { valid: result.valid, supportingText: result.supportingText };

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
        const settled = apply(await outcome);
        return settled;
      } catch (error) {
        return { valid: false, supportingText: error instanceof Error ? error.message : undefined };
      } finally {
        ctx.validating = false;
        step.validating = false;
        sync();
      }
    }
    return apply(outcome);
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

  const emitError = (index: number): void => {
    const step = ctx.steps[index];
    emit<StepperErrorEvent>(STEPPER_EVENTS.ERROR, {
      value: step.value,
      step: { ...step },
      supportingText: step.error ? step.supportingText : undefined,
    });
  };

  /** The one place the active step changes */
  const commit = async (index: number): Promise<boolean> => {
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
          markError(from, result.supportingText);
          sync();
          emitError(from);
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
    if (index === last && (target.completed || allDone)) {
      emit<StepperCompleteEvent>(STEPPER_EVENTS.COMPLETE, {
        value: target.value,
        steps: ctx.steps.map((step) => ({ ...step })),
      });
    }
    return true;
  };

  /** The guard that decides whether a move is possible at all */
  const allowed = (index: number): boolean => {
    if (ctx.validating) return false;
    const target = ctx.steps[index];
    if (!target || target.disabled) return false;
    const from = activeIndex();
    if (from < 0) return true;
    if (!settings.linear) return true;
    if (index < from) return !(ctx.steps[index].completed && !ctx.steps[index].editable);
    for (let j = from + 1; j < index; j++) {
      const step = ctx.steps[j];
      if (step && !step.completed && !step.optional) return false;
    }
    return true;
  };

  const goTo = async (target: number | string): Promise<boolean> => {
    if (destroyed) return false;
    const index = resolveTarget(ctx.steps, target);
    if (!allowed(index)) return false;
    return commit(index);
  };

  const next = async (): Promise<boolean> => {
    const from = activeIndex();
    if (from < 0) return false;
    if (from === ctx.steps.length - 1) {
      const result = await runValidation(from, null);
      if (!result.valid) {
        markError(from, result.supportingText);
        sync();
        emitError(from);
        return false;
      }
      ctx.steps[from].error = false;
      ctx.steps[from].completed = true;
      sync();
      emit<StepperCompleteEvent>(STEPPER_EVENTS.COMPLETE, {
        value: ctx.steps[from].value,
        steps: ctx.steps.map((step) => ({ ...step })),
      });
      return true;
    }
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
      markError(index, result.supportingText);
      emitError(index);
    }
    sync();
    return result.valid;
  };

  const reset = (): void => {
    const from = activeIndex();
    const headers = renderer.headers;
    headers.forEach((_header, index) => {
      const body = renderer.bodies[index];
      const forms = body?.querySelectorAll("form");
      forms?.forEach((form) => form.reset());
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
    ctx.declarations = steps;
    const states = steps.map(createStepState);
    const current = states[0];
    if (current) current.active = true;
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
    const wasActive = ctx.steps[index]?.active;
    ctx.declarations = ctx.declarations.filter((_step, i) => i !== index);
    setSteps(ctx.declarations);
    if (wasActive && ctx.steps[0]) {
      ctx.steps.forEach((step) => {
        step.active = false;
      });
      ctx.steps[0].active = true;
      sync();
    }
  };

  const focusedIndex = (): number => {
    const active = document.activeElement;
    return renderer.headers.findIndex((header) => header === active);
  };

  const onActionClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    const nextButton = target.closest(`[${STEPPER_ACTIONS.NEXT}]`);
    if (nextButton) return void next();
    const prevButton = target.closest(`[${STEPPER_ACTIONS.PREV}]`);
    if (prevButton) return void prev();
    const resetButton = target.closest(`[${STEPPER_ACTIONS.RESET}]`);
    if (resetButton) return reset();
    const gotoButton = target.closest<HTMLElement>(`[${STEPPER_ACTIONS.GOTO}]`);
    if (gotoButton) {
      const raw = gotoButton.getAttribute(STEPPER_ACTIONS.GOTO) ?? "";
      const asIndex = Number(raw);
      return void goTo(Number.isInteger(asIndex) ? asIndex : raw);
    }
  };

  component.element.addEventListener("click", onActionClick);

  return {
    getValue: () => activeValueOf(ctx.steps),
    setValue: async (value: string | null) => {
      if (value === null) {
        const first = ctx.steps.findIndex((step) => !step.disabled);
        return first >= 0 ? goTo(first) : false;
      }
      return goTo(value);
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
      return (renderer.panels.children[index]?.firstElementChild as HTMLElement) ?? null;
    },
    getHeaderElement: (target: number | string) => {
      const index = resolveTarget(ctx.steps, target);
      return renderer.headers[index] ?? null;
    },
    focusedIndex,
    destroy: () => {
      destroyed = true;
      component.element.removeEventListener("click", onActionClick);
    },
  };
};
