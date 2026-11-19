# material-addons

A form builder, a stepper, a colour picker, a layout schema and gesture recognition for [material](https://github.com/floor/material), the Material Design 3 component library. Written in TypeScript; its only dependency is `material`, as a peer.

- **Form.** Builds a set of fields from a layout and keeps their data: it reads and sets it, knows when it has changed, validates it and submits it.
- **Stepper.** An ordered list of steps over one panel at a time, with linear or free progression and a validation pipeline.
- **Colour picker.** An HSV area, a hue slider, swatches, a hex field and an eyedropper; inline, as a dropdown or as a dialog.
- **Layout.** Builds a tree of elements and components from an array, and gives each named component back.
- **Gestures.** Tap, swipe, long press, pan, pinch and rotate, on touch and mouse.

The form and the colour picker have a page with live examples on [md3.io](https://md3.io/docs/components/form/).

## Install

<!-- install -->
```bash
npm install material-addons material
```

This package's peer range is `material` `^3.15.1`.
<!-- /install -->

Both packages are ESM only. The examples below import stylesheets, so they need a bundler that handles CSS imports, such as Vite.

## Form

The layout is an array of `[factory, name, options]`. A field named `info.<key>` is the data's `<key>`. Buttons named `submit` and `cancel` submit and reset the form; they are enabled once the user has changed a field.

<!-- example: run, shows "Save" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createForm } from 'material-addons';
import { createTextField, createSwitch, createButton } from 'material';

const form = createForm({
  layout: [
    [createTextField, 'info.name', { label: 'Name' }],
    [createTextField, 'info.email', { label: 'Email', type: 'email' }],
    [createSwitch, 'info.newsletter', { label: 'Newsletter' }],
    [createButton, 'cancel', { text: 'Cancel', variant: 'text' }],
    [createButton, 'submit', { text: 'Save', variant: 'filled' }],
  ],
  data: { name: 'Ada', email: 'ada@example.com', newsletter: true },
  onSubmit: async (data) => console.log('Saved', data),
  container: document.body,
});
```

Two calls set the data, and they differ in what the form makes of it:

| Call | Meaning | Afterwards |
|------|---------|------------|
| `form.setData(data, true)` | Load: the data is the new starting point | Not modified; the buttons are disabled |
| `form.setData(data)`, `form.setFieldValue(name, value)` | Change values, as an edit does | Modified while the data differs from its starting point; the buttons are enabled |

<!-- example: continues -->
```javascript
form.setData({ name: 'Grace', email: 'grace@example.com', newsletter: false }, true);
console.log(form.isModified()); // false: loaded

form.setData({ name: 'Grace H.' });
console.log(form.isModified()); // true: changed, so Save is enabled

const { valid, errors } = form.validate();
```

`isModified()` only reads the state. The form emits `state:change` when the state changes.

Options, methods and events: [md3.io/docs/components/form](https://md3.io/docs/components/form/).

## Stepper

A stepper is an ordered list of steps and one panel at a time. Each step has a value, a label and optional supporting text; its content is what the panel shows. A move validates the step it leaves, and a listener can veto it.

<!-- example: run, shows "Account details" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createStepper } from 'material-addons';

const stepper = createStepper({
  steps: [
    { value: 'account', label: 'Account details', supportingText: 'Name and email', content: 'Your name and email.' },
    { value: 'address', label: 'Shipping address', optional: true, content: 'Where it goes.' },
    { value: 'review', label: 'Review and submit', content: 'All set.' },
  ],
  linear: true,
});
document.body.append(stepper.element);
```

`next()` runs the leaving step's validation, marks it completed and shows the following panel. Going back never marks a step. With `linear: true` a forward jump needs every step before the target completed or optional; `validateOnForward` alone runs the validation on a free stepper.

A validator returns a boolean, an object with `valid` and `supportingText`, or a promise of either. Every form and standalone control in the panel is checked first, with `reportValidity()` unless the option is off. While a promise settles the step is busy and a second move is ignored.

| Call | Meaning |
|------|---------|
| `next()`, `prev()` | The neighbouring enabled step |
| `goTo(value)`, `setValue(value)` | The step with that value |
| `validate(value)` | Run the pipeline without moving |
| `reset()` | Clear completion, reset the panel forms, first step |
| `setStepState(value, patch)`, `completeStep(value)`, `setError(value, flag, text)` | Change a step's state |

Before a move the factory emits a cancellable `beforechange`. After it, `change` and, on the last step, `complete`.

Each callback named after an event takes its payload; the table lists them all.

| Event | When | Cancellable |
|-------|------|-------------|
| `beforechange` | Before the active step changes | Yes, `preventDefault()` |
| `change` | After it changed | No |
| `complete` | The last step is reached | No |
| `error` | A validation stage failed | No |
| `reset` | `reset()` ran | No |
| `orientationchange` | An auto layout switched | No |

### The element

`<m-stepper>` with one `<m-step>` per step is the same component as a custom element. Its children stay in the light DOM and become the panel's content through a slot, so a form inside a step is an ordinary form.

<!-- example: fragment -->
```html
<m-stepper linear value="account">
  <m-step value="account" label="Account details">
    <form><input required></form>
    <div slot="actions"><button data-stepper-next>Continue</button></div>
  </m-step>
  <m-step value="address" label="Shipping address" no-edit></m-step>
</m-stepper>
```

Import the shadow stylesheet first, then define the elements:

<!-- example: fragment -->
```javascript
import 'material-addons/elements/css/stepper';
import { defineStepper } from 'material-addons/elements';

defineStepper();
```

The element takes the factory's options as attributes:

| Attribute | Values |
|-----------|--------|
| `value` | A step's value; the live model |
| `orientation` | `horizontal`, `vertical` or `auto` |
| `auto-breakpoint` | A width in pixels, `600` by default |
| `linear` | Present for linear progression |
| `label-placement` | `end` or `bottom` |
| `header-placement` | `top` or `bottom` |
| `no-report-validity` | Present to skip `reportValidity()` |
| `optional-supporting-text` | The caption for optional steps |
| `aria-label` | The group label, `Progress` by default |
| `disabled` | Present to disable the whole stepper |

A `<m-step>` declares one step:

| Attribute | Meaning |
|-----------|---------|
| `value` | The identifier `goTo()` and the model use |
| `label` | The step title |
| `supporting-text` | A hint under the label |
| `icon` | The indicator's glyph |
| `completed`, `error`, `optional`, `disabled` | The step's state |
| `no-edit` | Present to bar returning once completed |

### Size

Measured as standalone minified ESM bundles, gzipped, with `material` external; the element's bundle also has the factory external. `scripts/stepper-size.mjs` prints the row.

| Artifact | Measured | Target |
|----------|----------|--------|
| `createStepper` | 6.6 KB | 2.2 KB |
| `<m-stepper>` and `<m-step>` | 1.5 KB | 0.7 KB |
| The compiled stylesheet | 1.6 KB | 1.4 KB |

The targets were estimates made before the implementation, and all three rows
exceed them; the row records what was measured, not what was hoped for.

Where the factory's bytes go, in source: the navigation, validation and
action handling is 20 KB and the renderer 12 KB; the rest is 15 KB between
them.

The renderer builds fifteen parts and their ARIA state. The navigation runs
the three validation stages and the completion rules.

The element is 10.7 KB of source for ten attributes and the declaration
class. The sheet is 7.3 KB minified for the token set and the layout blocks.

## Colour picker

<!-- example: run, shows "#6750a4" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createColorPicker } from 'material-addons';

const picker = createColorPicker({
  value: '#6750a4',
  swatches: ['#6750a4', '#625b71', '#7d5260', '#b3261e'],
});

const chosen = document.createElement('p');
chosen.textContent = picker.getValue();
picker.on('change', (color) => { chosen.textContent = String(color); });

document.body.append(picker.element, chosen);
```

Variants, sizes, opacity and the eyedropper: [md3.io/docs/components/colorpicker](https://md3.io/docs/components/colorpicker/).

The colour conversions the picker uses are exported too:

<!-- example: run, shows "#ff0080" -->
```javascript
import { hsvToRgb, rgbToHsv, rgbToHex, hexToRgb, normalizeHex, getContrastColor } from 'material-addons';

const results = [
  hsvToRgb(330, 100, 100),      // { r: 255, g: 0, b: 128 }
  rgbToHsv(255, 0, 128),        // { h: 330, s: 100, v: 100 }
  rgbToHex(255, 0, 128),        // '#ff0080'
  hexToRgb('#ff0080'),          // { r: 255, g: 0, b: 128 }
  normalizeHex('f00'),          // '#ff0000'
  getContrastColor('#ffffff'),  // '#000000'
];

document.body.append(...results.map((result) => {
  const line = document.createElement('p');
  line.textContent = typeof result === 'string' ? result : JSON.stringify(result);
  return line;
}));
```

## Layout

`createLayout` takes an array: a tag or a factory, a name when the item is to be read back, its options, then its children. It returns the root element and each named component.

<!-- example: run, shows "Send" -->
```javascript
import 'material/styles';
import { createLayout } from 'material-addons/layout';
import { createButton, createTextField } from 'material';

const layout = createLayout([
  'section', { class: 'contact' },
  [createTextField, 'name', { label: 'Name' }],
  [createButton, 'send', { text: 'Send', variant: 'filled' }],
]);

layout.get('send').on('click', () => console.log(layout.get('name').getValue()));

document.body.append(layout.element);
```

## Gestures

<!-- example: run, shows "Tap or swipe me" -->
```javascript
import { createGestureManager } from 'material-addons/gestures';

const card = document.createElement('div');
card.textContent = 'Tap or swipe me';
document.body.append(card);

const gestures = createGestureManager(card);

gestures.on('tap', ({ x, y }) => { card.textContent = `Tapped at ${x}, ${y}`; });
gestures.on('swipe', ({ direction }) => { card.textContent = `Swiped ${direction}`; });
gestures.on('longpress', () => { card.textContent = 'Long press'; });
```

When the element goes away, release the listeners:

<!-- example: continues -->
```javascript
gestures.destroy();
```

The gestures:

| Event | Fires on |
|-------|----------|
| `tap` | A press and release in place |
| `swipe`, and `swipeleft`, `swiperight`, `swipeup`, `swipedown` | A quick move in one direction |
| `longpress` | A press held, 500 ms by default |
| `pan` | A drag |
| `pinch` | Two fingers moving together or apart |
| `rotate` | Two fingers turning |

## Entry points

| Import | From |
|--------|------|
| The form, the colour picker, the colour conversions | `material-addons` |
| The layout | `material-addons/layout` |
| The gestures | `material-addons/gestures` |
| The same three, without the layout and gesture exports | `material-addons/components` |
| The stepper element | `material-addons/elements`, `material-addons/elements/stepper` |
| The stepper's shadow styles | `material-addons/elements/css/stepper` |
| A component's constants | `material-addons/components/form/constants`, `material-addons/components/colorpicker/constants`, `material-addons/components/stepper/constants` |
| The stylesheet | `material-addons/styles` |

## Upgrading

The package was published as `mtrl-addons` up to 0.9.x; from 3.0.0 it is `material-addons`, for `material` 3. Two things change:

- Dependency: remove `mtrl-addons`; install `material-addons` beside `material`.

  ```bash
  npm uninstall mtrl-addons
  npm install material-addons material
  ```

- Import: `mtrl-addons` becomes `material-addons` in every specifier. The styles, layout, gestures and components subpaths change with it.

What each release changed, and what 0.8.0 removed (the virtual list and the viewport), is in the [changelog](CHANGELOG.md).

## Development

```bash
bun install                 # dependencies
bun test                    # the tests
bun run ts:check            # the types
bun run dev                 # build into dist/, and again on each change
bun run build --production  # the build a release ships
bun run check:package       # the packed package: its files, its manifest, its entry points
bun run readme:check        # this file's examples, in Chromium
bun run link:material       # use the material checkout in ../material
```

Three of them need something first:

- `check:package` compares the packed files with the release's list, so it needs the production build.
- `readme:check` needs a build, and Chromium once: `npx playwright install chromium`.
- `link:material` needs `../material` to be built.

## Releasing

Until the trusted publisher is bound, publish by hand:

```bash
npm run release:pack
npm publish material-addons-<version>.tgz --access public
```

`release:pack` runs the gate first: the types, the tests, the production build, the packed package and the README's examples, so it needs Chromium once (see Development). `npm publish` tags a release `latest`; a pre-release passes `--tag next`.

Tag only on main: the release workflow refuses a `v*` tag whose commit is not on `origin/main`. A `v*` tag ruleset, so only the owner creates release tags, is recommended. The workflow creates the GitHub release as well, its notes taken from the released version's `CHANGELOG.md` section.

## Related

- [material](https://github.com/floor/material): the Material Design 3 component library this package extends.
- [md3.io](https://md3.io): the documentation and showcase site.

## License

MIT, see [LICENSE](LICENSE).
