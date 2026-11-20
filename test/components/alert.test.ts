import { describe, expect, test } from "bun:test";
import { setIcons } from "material/core/icons";
import { createAlert } from "../../src/components/alert";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

describe("createAlert", () => {
  installAutocompleteDom();

  test("defaults to info tonal status alert and falls back for unknown options", () => {
    const alert = createAlert({ severity: "unknown", variant: "unknown", className: "custom-alert" });
    const root = alert.element;
    expect(root.localName).toBe("div");
    expect(root.classList.contains("custom-alert")).toBe(true);
    expect([alert.getSeverity(), alert.getVariant(), alert.isOpen(), alert.isDismissible()]).toEqual([
      "info",
      "tonal",
      true,
      false,
    ]);
    expect(root.getAttribute("role")).toBe("status");
    expect(root.classList.contains("mtrl-alert--info")).toBe(true);
    expect(root.classList.contains("mtrl-alert--tonal")).toBe(true);
    expect(root.querySelector(".mtrl-alert__icon svg")).not.toBeNull();
    expect(root.querySelector(".mtrl-alert__sr-severity")?.textContent).toBe("Info: ");
    expect(root.querySelector(".mtrl-alert__actions")).toBeNull();

    alert.setSeverity("warning").setSeverity("invalid").setVariant("outlined").setVariant("invalid");
    expect(alert.getSeverity()).toBe("info");
    expect(alert.getVariant()).toBe("tonal");
    alert.destroy();
  });

  test("maps severity to role=status vs role=alert and respects explicit role override", () => {
    const alert = createAlert({ severity: "info" });
    const root = alert.element;
    expect(root.getAttribute("role")).toBe("status");

    alert.setSeverity("success");
    expect(root.getAttribute("role")).toBe("status");
    expect(root.querySelector(".mtrl-alert__sr-severity")?.textContent).toBe("Success: ");

    alert.setSeverity("warning");
    expect(root.getAttribute("role")).toBe("alert");
    expect(root.querySelector(".mtrl-alert__sr-severity")?.textContent).toBe("Warning: ");

    alert.setSeverity("error");
    expect(root.getAttribute("role")).toBe("alert");
    expect(root.querySelector(".mtrl-alert__sr-severity")?.textContent).toBe("Error: ");

    alert.setSeverity("info");
    expect(root.getAttribute("role")).toBe("status");
    alert.destroy();

    const regionAlert = createAlert({ severity: "error", role: "region", severityLabel: "" });
    expect(regionAlert.element.getAttribute("role")).toBe("region");
    expect(regionAlert.element.querySelector(".mtrl-alert__sr-severity")).toBeNull();
    regionAlert.setSeverity("info");
    expect(regionAlert.element.getAttribute("role")).toBe("region");
    regionAlert.destroy();
  });

  test("handles custom icon, noIcon, and getIcon('close') override", () => {
    setIcons({ close: '<svg data-custom-close="1"></svg>' });
    try {
      const alert = createAlert({
        severity: "warning",
        icon: '<svg data-custom-icon="1"></svg>',
        dismissible: true,
        dismissLabel: "Close alert",
      });
      const root = alert.element;
      expect(root.querySelector(".mtrl-alert__icon [data-custom-icon]")).not.toBeNull();
      expect(root.querySelector(".mtrl-alert__dismiss")?.getAttribute("aria-label")).toBe("Close alert");
      expect(root.querySelector(".mtrl-alert__dismiss [data-custom-close]")).not.toBeNull();

      alert.setNoIcon(true);
      expect(root.querySelector(".mtrl-alert__icon")).toBeNull();

      alert.setNoIcon(false).setIcon(undefined);
      expect(root.querySelector(".mtrl-alert__icon svg")).not.toBeNull();
      expect(root.querySelector(".mtrl-alert__icon [data-custom-icon]")).toBeNull();
      alert.destroy();
    } finally {
      setIcons({ close: null });
    }
  });

  test("toggles multiline class when both label and supportingText are present", () => {
    const alert = createAlert({ label: "Update ready" });
    const root = alert.element;
    expect(root.classList.contains("mtrl-alert--multiline")).toBe(false);
    expect(root.querySelector(".mtrl-alert__label")?.textContent).toBe("Update ready");
    expect(root.querySelector(".mtrl-alert__supporting-text")).toBeNull();

    alert.setSupportingText("Restart the application to finish updating.");
    expect(root.classList.contains("mtrl-alert--multiline")).toBe(true);
    expect(root.querySelector(".mtrl-alert__supporting-text")?.textContent).toBe(
      "Restart the application to finish updating.",
    );

    alert.setLabel(undefined);
    expect(root.classList.contains("mtrl-alert--multiline")).toBe(false);
    expect(root.querySelector(".mtrl-alert__label")).toBeNull();
    alert.destroy();
  });

  test("emits action event and runs vetoable beforedismiss -> dismiss lifecycle", () => {
    const actions: string[] = [];
    const dismissed: string[] = [];
    let veto = true;

    const alert = createAlert({
      severity: "error",
      label: "Payment failed",
      action: "Retry",
      dismissible: true,
      onAction: ({ severity }) => actions.push(severity),
      onBeforeDismiss: (event) => {
        if (veto) event.preventDefault();
      },
      onDismiss: ({ severity, reason }) => dismissed.push(`${severity}:${reason}`),
    });

    const root = alert.element;
    root.querySelector<HTMLButtonElement>(".mtrl-alert__action")!.click();
    expect(actions).toEqual(["error"]);

    // First dismiss attempt is vetoed
    root.querySelector<HTMLButtonElement>(".mtrl-alert__dismiss")!.click();
    expect(alert.isOpen()).toBe(true);
    expect(root.hidden).toBe(false);
    expect(dismissed).toEqual([]);

    // Allow dismissal
    veto = false;
    root.querySelector<HTMLButtonElement>(".mtrl-alert__dismiss")!.click();
    expect(alert.isOpen()).toBe(false);
    expect(root.hidden).toBe(true);
    expect(root.classList.contains("mtrl-alert--closed")).toBe(true);
    expect(dismissed).toEqual(["error:button"]);

    // Second dismiss while already closed returns false
    expect(alert.dismiss()).toBe(false);

    // Show restores visibility
    alert.show();
    expect(alert.isOpen()).toBe(true);
    expect(root.hidden).toBe(false);
    expect(root.classList.contains("mtrl-alert--closed")).toBe(false);
    alert.destroy();
  });
});
