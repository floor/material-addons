import { describe, expect, test } from "bun:test";
import { createNavigationTabs, renderNavigationTabs } from "../../src/components/navigation-tabs";
import { installDom } from "../utils/dom";

test("renders a landmark with escaped native links and one current page", () => {
  expect(renderNavigationTabs('Docs "A&B"', [
    { href: '/docs?a="b"&c=d', label: "Develop <A>", current: true },
    { href: "/matrix", label: "Matrix", current: true, icon: "<svg></svg>" },
  ], { sticky: true })).toBe(
    '<nav class="mtrl-navigation-tabs mtrl-navigation-tabs--sticky" aria-label="Docs &quot;A&amp;B&quot;">'
    + '<a class="mtrl-navigation-tabs__tab" href="/docs?a=&quot;b&quot;&amp;c=d" aria-current="page">'
    + '<span class="mtrl-navigation-tabs__indicator" aria-hidden="true"></span>'
    + '<span class="mtrl-navigation-tabs__label">Develop &lt;A&gt;</span></a>'
    + '<a class="mtrl-navigation-tabs__tab" href="/matrix"><span class="mtrl-navigation-tabs__indicator" aria-hidden="true"></span>'
    + '<span class="mtrl-navigation-tabs__icon" aria-hidden="true"><svg></svg></span>'
    + '<span class="mtrl-navigation-tabs__label">Matrix</span></a></nav>',
  );
});

describe("createNavigationTabs", () => {
  installDom();

  function mount() {
    const container = document.createElement("div");
    container.innerHTML = renderNavigationTabs("Docs", [
      { href: "#overview", label: "Overview", current: true },
      { href: "#matrix", label: "Matrix" },
    ]);
    document.body.append(container);
    return { container, element: container.querySelector("nav")! };
  }

  test("adopts the links, emits once per current-page change and leaves routing to the caller", () => {
    const { container, element } = mount();
    const links = [...element.querySelectorAll("a")];
    const tabs = createNavigationTabs({ element, ripple: false, sticky: true });
    const changes: Array<string | null> = [];
    tabs.on("change", ({ href }) => { changes.push(href); });
    expect(tabs.element).toBe(element);
    expect(tabs.getCurrent()).toBe("#overview");
    expect(element.classList.contains("mtrl-navigation-tabs--sticky")).toBe(true);
    links[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(tabs.getCurrent()).toBe("#overview");
    tabs.setCurrent("#missing").setCurrent("#matrix").setCurrent("#matrix");
    expect([...element.querySelectorAll("a")]).toEqual(links);
    expect(element.querySelector('[aria-current="page"]')).toBe(links[1]);
    tabs.setCurrent(null);
    expect(tabs.getCurrent()).toBeNull();
    expect(changes).toEqual(["#matrix", null]);
    expect(element.querySelector(".mtrl-ripple")).toBeNull();
    tabs.destroy();
    expect(container.firstElementChild).toBe(element);
    container.remove();
  });

  test("cleans up the ripple without removing the server markup and can be mounted again", () => {
    const { container, element } = mount();
    const tabs = createNavigationTabs({ element });
    expect(createNavigationTabs({ element })).toBe(tabs);
    expect(element.querySelectorAll(".mtrl-ripple")).toHaveLength(2);
    tabs.destroy();
    expect(element.querySelectorAll(".mtrl-ripple")).toHaveLength(0);
    expect(tabs.getCurrent()).toBe("#overview");
    const again = createNavigationTabs({ element });
    expect(again).not.toBe(tabs);
    expect(element.querySelectorAll(".mtrl-ripple")).toHaveLength(2);
    again.destroy();
    container.remove();
  });
});
