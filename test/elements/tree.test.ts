// test/elements/tree.test.ts
//
// The element: attribute reflection, the item declarations, and that
// importing the module touches no document.

import { describe, expect, test } from "bun:test";
import { installAutocompleteDom } from "../utils/autocomplete-dom";
import { treeElement, defineTree, treeItemDeclaration } from "../../src/elements/tree";

describe("<m-tree>", () => {
  installAutocompleteDom();

  test("the declaration names the item tag and its attributes", () => {
    expect(treeItemDeclaration.name).toBe("tree-item");
    expect(Object.keys(treeItemDeclaration.attributes)).toEqual([
      "value", "label", "supporting-text", "expanded", "lazy", "disabled", "selected",
    ]);
  });

  test("defineTree registers both tags and renders authored items", () => {
    document.body.innerHTML = "";
    const host = document.createElement("m-tree");
    host.setAttribute("selection", "multiple");
    host.setAttribute("aria-label", "Files");
    host.innerHTML = `
      <m-tree-item value="src" label="src" expanded>
        <m-tree-item value="tree" label="tree.ts"></m-tree-item>
      </m-tree-item>
      <m-tree-item value="readme" label="README" selected></m-tree-item>
    `;
    document.body.append(host);
    const tag = defineTree();
    expect(tag).toBe("m-tree");
    expect(customElements.get("m-tree-item")).toBeTruthy();
    const root = host.shadowRoot?.querySelector(".mtrl-tree");
    expect(root?.getAttribute("role")).toBe("tree");
    const items = host.shadowRoot?.querySelectorAll("[role='treeitem']");
    expect(items?.length).toBe(3); // src + tree.ts (expanded) + README
    expect(host.shadowRoot?.querySelector('[data-value="readme"]')?.getAttribute("aria-checked")).toBe("true");
  });
});
