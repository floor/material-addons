# material-addons

A form builder, a stepper, an autocomplete, a colour picker, a layout schema and gesture recognition for [material](https://github.com/floor/material), the Material Design 3 component library. The TypeScript library requires Material as a peer. The framework adapters use optional peers.

- **Form.** Builds a set of fields from a layout and keeps their data: it reads and sets it, knows when it has changed, validates it and submits it.
- **Autocomplete.** An editable text field with a suggestion popup, keyboard navigation and optional async suggestions.
- **Stepper.** An ordered list of steps over one panel at a time, with linear or free progression, a validation pipeline and compact displays.
- **Expansion panel.** A disclosure panel with a header button and a collapsible body, and an accordion that coordinates several of them.
- **Alert.** An inline status or severity callout with a leading icon, a headline and body copy, an optional action button and a cancellable dismiss.
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

### Compact displays

A stepper can show less of each step. `display` picks how much, and defaults to `labels`.

| Value | Shows |
|-------|-------|
| `labels` | Every step's label and indicator, as above |
| `count` | One line, "Step 2 of 4: Shipping address" |
| `dots` | Dots only; the headers stay clickable and keep their names |
| `progress` | A determinate progress bar and the same line as `count` |

`count` and `progress` replace the header list with a read-only status line, so the panel's action buttons move the user; `dots` keeps the headers interactive. The polite live region announces every change in all four modes.

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
| `display` | `labels`, `count`, `dots` or `progress` |
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

### Framework adapters

Install the framework you use. The factory and custom element imports work without a framework dependency.

| Framework | Import | Components | Two-way state |
| --- | --- | --- | --- |
| React | `material-addons/react` | `Stepper`, `Step` | `value` and `onChange` |
| Vue | `material-addons/vue` | `MStepper`, `MStep` | `v-model` or `v-model:value` |
| Svelte 5 | `material-addons/svelte` | `Stepper`, `Step` | `bind:value` |
| Solid | `material-addons/solid` | `Stepper`, `Step` | `value` and `onChange` |

The adapters load the shadow styles and register both tags when mounted. They pass the same typed custom events as the elements. Call `preventDefault()` on the before-change event to veto navigation.

| Event API | Before change | Validation failed |
| --- | --- | --- |
| React and Solid callbacks | `onBeforechange` | `onValidationerror` |
| Vue listeners | `@beforechange` | `@validationerror` |
| Svelte callbacks | `onbeforechange` | `onvalidationerror` |

### Size

Measured as standalone minified ESM bundles, gzipped, with `material` external; the element's bundle also has the factory external. `scripts/stepper-size.mjs` prints the row.

| Artifact | Measured | Target |
|----------|----------|--------|
| `createStepper` | 7.1 KB | 2.2 KB |
| `<m-stepper>` and `<m-step>` | 1.5 KB | 0.7 KB |
| The compiled stylesheet | 1.7 KB | 1.4 KB |

The targets were estimates made before the implementation, and all three rows
exceed them; the row records what was measured, not what was hoped for.

Where the factory's bytes go, in source: the navigation, validation and
action handling is 21 KB and the renderer 13 KB; the rest is 15 KB between
them.

The renderer builds fifteen parts and their ARIA state. The navigation runs
the three validation stages and the completion rules.

The element is 10.7 KB of source for ten attributes and the declaration
class. The sheet is 8.6 KB minified for the token set, the layout blocks and the four
displays.

## Expansion panel

An expansion panel shows a header and hides or reveals a body below it. Several panels can sit in an accordion, which closes the open one when another opens unless `multiSelect` is set.

<!-- example: run, shows "Trip details" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createAccordion } from 'material-addons';

const accordion = createAccordion({
  panels: [
    { value: 'dates', label: 'Trip details', supportingText: 'May 12 to May 20', content: 'Start and end dates.' },
    { value: 'people', label: 'Travelers', content: '2 adults.', open: true },
  ],
});
document.body.append(accordion.element);
```

Opening and closing each run a cancellable before-event, then emit the state events and a change; the after-events follow the transition. The silent setter changes the state without them.

`lazy` defers a content function until the first open. `divider` draws a line above the body, and `error` paints the header in the error colour.

The accordion exposes its open values and can open or close them all. The arrow keys move focus between enabled headers, wrapping at the ends, with Home and End at the extremes.

### The elements

The children of a panel are its body. A child with a label, supporting-text or actions slot fills that part instead.

| `<m-expansion-panel>` attribute | Value |
|-----------|-------|
| `open` | Reflects the expanded state, as `<details>` does |
| `value` | The panel's identifier |
| `label`, `supporting-text` | The header's two lines |
| `variant`, `density`, `placement` | The same options as the factory |
| `no-toggle`, `divider`, `lazy`, `error`, `disabled` | Presence flags |
| `leading-icon`, `trailing-icon` | Markup for the header icons |
| `heading-level`, `aria-label` | The heading level and the button's name |

`<m-accordion>` coordinates its `<m-expansion-panel>` children where they stand:

| `<m-accordion>` attribute | Value |
|-----------|-------|
| `value` | The open panel's value, the live model |
| `multi-select` | Present to keep several panels open |
| `variant`, `density`, `placement` | Propagated to panels that set none |
| `separated`, `disabled` | Presence flags |

<!-- example: fragment -->
```html
<m-accordion value="dates">
  <m-expansion-panel value="dates" label="Trip details" supporting-text="May 12 to May 20">
    <p>Start and end dates.</p>
    <div slot="actions"><button data-action>Save</button></div>
  </m-expansion-panel>
  <m-expansion-panel value="people" label="Travelers"><p>2 adults.</p></m-expansion-panel>
</m-accordion>
```

### Size

Measured as standalone minified ESM bundles, gzipped, with `material` external; the element's bundle also has the factories external. `scripts/expansion-panel-size.mjs` prints the row.

| Artifact | Measured | Target |
|----------|----------|--------|
| `createExpansionPanel` and `createAccordion` | 5.2 KB | 1.4 KB |
| `<m-expansion-panel>` and `<m-accordion>` | 1.9 KB | 0.6 KB |
| The compiled stylesheet | 1.5 KB | 0.9 KB |

The targets were estimates made before the implementation and all three rows exceed them; the row records what was measured.

## Skeleton

<!-- example: fragment -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createSkeleton } from 'material-addons';

const skeleton = createSkeleton({ variant: 'text', lines: 3 });
document.body.append(skeleton.element);
```

A skeleton is a loading placeholder. Material Design 3 publishes no skeleton
component: the shape reads the transitions page's direction (a subtle sweep
from the reading-order origin toward the far corner) on tone-based surface
roles, and every number the library fixes is a `--mtrl-skeleton-*` token.

The shape is a `variant`: a text bar, the avatar circle, or a block. The
`size` axis is small, medium or large, and a circle uses the avatar boxes.
`lines` is the text bar count, the same option `ListItem` uses. The
`motion` is the wave sweep (the default) or a contained pulse.

The shape is always hidden from assistive technology; a standalone
skeleton's root carries `aria-busy` while it stands in, and `busy: false`
(the element's `no-busy`) leaves it off. No events, no focus, no disabled
state: a skeleton is not a control

### Layout placeholders

The second layer renders those shapes from the same schema the real layout
uses, then swaps the real components in without moving the layout classes.
The creator map decides each placeholder's box, so register what you render:
the placeholder holds exactly the box the real component will take.

<!-- example: fragment -->
```javascript
import { skeleton } from 'material-addons/layout';
import { registerSkeleton } from 'material-addons/components/skeleton';
import { createAvatar } from 'material-addons/components/avatar';

// the avatar stands in as its circle, at the avatar box
registerSkeleton(createAvatar, (options) => ({
  variant: 'circle', size: options.size ?? 'large',
}));

// a field stands in as a block the field's own box, width and height
registerSkeleton(createTextField, () => ({
  variant: 'rect', inlineSize: '280px', blockSize: '56px',
}));

const layout = skeleton([
  'div',
  { layout: { type: 'row', gap: '1rem' } },
  [createAvatar, 'avatar', { size: 'large' }],
  [createTextField, 'name', { label: 'Name' }],
]);

// when the data lands:
layout.reveal();
```

The stack, row or grid is real; only the component leaves stand in. Each
placeholder fills a host `div` that carries the layout classes the real
element would have taken, and `reveal()` replaces the placeholder inside
the same host. The region (the parent the layout was built into) carries
`aria-busy` until `reveal()`.

The page does not shift when the placeholder is sized like the real
content: an `inlineSize` or `blockSize` from the mapping, or a built-in
mapping measured to match. A placeholder sized differently lets the real
component take its own size at the cost of one reflow, never a permanent
clip.

A form forwards the same flag: `createForm({ layout, skeleton: true })`
renders its fields as placeholders and its own `reveal()` swaps them in.

### Element

<!-- example: fragment -->
```html
<m-skeleton variant="text" lines="3"></m-skeleton>
<m-skeleton variant="circle" size="large"></m-skeleton>
```

Every attribute is also a property, and `no-busy` opts out of the busy
flag. The element is client-only, and its three parts are styleable through
`::part()`. The framework adapters export it as `Skeleton` (React, Solid,
Svelte) and `MSkeleton` (Vue) with the same attributes as props.

### Size

Measured as standalone minified ESM bundles, gzipped, with `material`
external. `scripts/skeleton-size.mjs` prints the rows.

| Artifact | Measured | Target |
|----------|----------|--------|
| `createSkeleton` and the creator map | 1.1 KB | 1.2 KB |
| The compiled stylesheet | 0.8 KB | 0.8 KB |

The targets were the spec note's estimates; the row records what was
measured.

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

## Autocomplete

The factory uses Material's text field and listbox styles. Pass strings for simple suggestions or objects with a stable value and a display label.

<!-- example: run, shows "France" -->
```javascript
import 'material/styles';
import 'material/styles/listbox';
import 'material-addons/styles';
import { createAutocomplete } from 'material-addons/components/autocomplete';

const country = createAutocomplete({
  label: 'Country',
  name: 'country',
  strict: true,
  options: [{ value: 'fr', text: 'France' }, { value: 'jp', text: 'Japan' }],
  value: 'fr',
});
document.body.append(country.element);
country.open();
```

With strict mode, only a suggestion can be selected. In free-form mode, blurring commits other text. For remote suggestions, supply an async source that accepts the query and an abort signal. Set `filter: false` when the source filters its own results.

The custom element uses its option children as suggestions. The style module registers the shadow sheets before the element is defined.

<!-- example: run, shows "Switzerland" -->
```javascript
import 'material/styles';
import 'material-addons/elements/preupgrade.css';
import 'material-addons/elements/css/autocomplete';
import { defineAutocomplete } from 'material-addons/elements/autocomplete';

document.body.innerHTML = `
  <m-autocomplete label="Country" value="ch" strict>
    <m-autocomplete-option value="ch">Switzerland</m-autocomplete-option>
  </m-autocomplete>
`;
defineAutocomplete();
document.querySelector('m-autocomplete').open();
```

#### Framework adapters

| Framework | Import | Components | Model |
| --- | --- | --- | --- |
| React | `material-addons/react` | `Autocomplete`, `AutocompleteOption` | `value` and `onChange` |
| Vue | `material-addons/vue` | `MAutocomplete`, `MAutocompleteOption` | `v-model` or `v-model:value` |
| Svelte 5 | `material-addons/svelte` | `Autocomplete`, `AutocompleteOption` | `bind:value` |
| Solid | `material-addons/solid` | `Autocomplete`, `AutocompleteOption` | `value` and `onChange` |

Use `defaultValue` for an uncontrolled initial selection. The adapters register the elements and shadow styles on the client. Each entry exports `AutocompleteElementEventMap`. Event handlers receive the custom event, and `event.detail.value` carries the selection on `change`. In Svelte use lowercase handler props such as `onchange` and `onselect`. Import `material-addons/styles` for pre-upgrade styles.

The element works in the browser and submits its committed value under its name. Its definition can be imported on the server.

## Avatar

Use an image, a monogram, or an icon. The small, medium, and large sizes draw a 24, 30, or 40 px shape. A button or link has a target of at least 48 × 48 px. `supportingText` describes the avatar, and `ariaLabel` overrides its accessible name. Set `decorative` when the surrounding content already names it.

<!-- example: run, shows "Ada Lovelace" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createAvatar } from 'material-addons/components/avatar';

const avatar = createAvatar({
  variant: 'text',
  text: 'AL',
  label: 'Ada Lovelace',
  supportingText: 'Editor',
  badge: { variant: 'large', label: 3 },
});
document.body.append(avatar.element);
```

Pass trusted markup or an element as factory `content`. For `<m-avatar>`, place image or icon markup in the default slot and import the avatar's shadow styles before calling `defineAvatar()`.

<!-- example: fragment -->
```html
<m-avatar variant="text" text="AL" label="Ada Lovelace" supporting-text="Editor"></m-avatar>
```

<!-- example: fragment -->
```javascript
import 'material-addons/elements/css/avatar';
import { defineAvatar } from 'material-addons/elements/avatar';

defineAvatar();
```

Set `href` for a link. In the factory, pass `onClick` for a native button. On the element, register a direct `click` listener after `defineAvatar()` to make it a button. A disabled avatar blocks activation. The badge uses Material's badge; `placement` uses logical corners and follows writing direction.

| Framework | Import | Component | Click handler |
| --- | --- | --- | --- |
| React | `material-addons/react` | `Avatar` | `onClick` |
| Vue | `material-addons/vue` | `MAvatar` | `@click` |
| Svelte 5 | `material-addons/svelte` | `Avatar` | `onclick` |
| Solid | `material-addons/solid` | `Avatar` | `onClick` |

The adapters register the client element and shadow styles. Each framework entry exports `AvatarElementEventMap`. Click handlers receive a native `MouseEvent`.

### Size

Production CI measures each artifact separately at gzip level 9. Material dependencies and framework runtimes are external.

| Artifact | Gzip | Spec estimate |
| --- | ---: | ---: |
| Factory | 2,592 B | 1,200 B |
| Client element | 1,141 B | 500 B |
| Compiled stylesheet | 1,244 B | 800 B |
| Combined | 4,977 B | 2,500 B |

## Paginator

One page of a set: a rows-per-page select, the live range, and first, previous, next and last. Material Design 3 publishes no paginator; the row geometry and the 25-row page follow the MD2 data-table behavior, on the shipped system roles. `page` is the model, 1-based and clamped to the page count.

<!-- example: run, shows "26–50 of 100" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createPaginator } from 'material-addons/components/paginator';

const paginator = createPaginator({ page: 2, pageSize: 25, total: 100 });
document.body.append(paginator.element);

const status = document.createElement('p');
status.textContent = paginator.range.textContent;
paginator.on('change', (event) => { status.textContent = `${event.page} / ${event.pageSize}`; });
document.body.append(status);
```

`goTo(page)` is the guarded move. It emits `beforechange`, and only then `change`. `setPage` and `setPageSize` are silent and clamp. So is `setTotal`. `numbered` adds page buttons between previous and next. The page list keeps `siblingCount` around the current page and `boundaryCount` at the ends. `ends: false` drops first and last, as `no-ends` does on the element.

<!-- example: fragment -->
```html
<m-paginator page="2" page-size="25" total="100" numbered></m-paginator>
```

<!-- example: fragment -->
```javascript
import 'material-addons/elements/css/paginator';
import { definePaginator } from 'material-addons/elements/paginator';

definePaginator();
```

The element dispatches one cancelable change. Its detail is `{ page, pageSize }`, raised from the factory's beforechange. Calling `preventDefault()` leaves the page where it was. `pageSizes` is a property. The data grid composes this contract.

| Framework | Import | Component | Event |
| --- | --- | --- | --- |
| React | `material-addons/react` | `Paginator` | `onChange` |
| Vue | `material-addons/vue` | `MPaginator` | `@change` |
| Svelte 5 | `material-addons/svelte` | `Paginator` | `onchange` |
| Solid | `material-addons/solid` | `Paginator` | `onChange` |

### Size

Measured as standalone minified ESM bundles, gzipped, with `material` external; the element's bundle also has the factory external. `scripts/paginator-size.mjs` prints the row.

| Artifact | Gzip | Spec estimate |
| --- | ---: | ---: |
| Factory | 3,426 B | 1,600 B |
| Client element | 914 B | 700 B |
| Compiled stylesheet | 1,072 B | 900 B |
| Combined | 5,412 B | 3,200 B |

## Breadcrumb

A trail of ancestor pages with the current one last. Material Design 3 publishes no breadcrumb; the landmark, the ordered list and `aria-current="page"` follow the WAI-ARIA pattern. The current item is the last item in the trail, and `value` is its stable id.

<!-- example: run, shows "Chair" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createBreadcrumb } from 'material-addons/components/breadcrumb';

const trail = createBreadcrumb({
  items: [
    { value: 'home', label: 'Home', href: '#home' },
    { value: 'rooms', label: 'Rooms', href: '#rooms' },
    { value: 'chair', label: 'Chair' },
  ],
});
document.body.append(trail.element);

trail.on('change', (event) => {
  document.title = String(event.value);
});
```

An ancestor with `href` is a link and one without it is a button. `goTo(value)` emits `beforechange`, and a cancelled event leaves the trail unchanged; the component never rewrites the items, the caller sets the new trail with `setItems`. `setValue` and `setItems` are silent.

When the row overflows, the middle items collapse into material's menu behind an overflow button, so the popup sits in the top layer, and the first item and the current page stay visible. `collapse: false` skips that and lets the row scroll, as `no-collapse` does on the element.

<!-- example: fragment -->
```html
<m-breadcrumb>
  <m-breadcrumb-item value="home" href="/">Home</m-breadcrumb-item>
  <m-breadcrumb-item value="chair">Chair</m-breadcrumb-item>
</m-breadcrumb>
```

<!-- example: fragment -->
```javascript
import 'material-addons/elements/css/breadcrumb';
import { defineBreadcrumb } from 'material-addons/elements/breadcrumb';

defineBreadcrumb();
```

The element reads its item children and rebuilds the trail when they change. The last child is current and its `href` is ignored. The element dispatches two events. The first is `beforechange` and it is cancelable. Its detail carries `previousValue` and `value`. The second is `change` and it follows the commit.

| Framework | Import | Component | Events |
| --- | --- | --- | --- |
| React | `material-addons/react` | `Breadcrumb` | `onBeforechange`, `onChange` |
| Vue | `material-addons/vue` | `MBreadcrumb` | `@beforechange`, `@change` |
| Svelte 5 | `material-addons/svelte` | `Breadcrumb` | `onbeforechange`, `onchange` |
| Solid | `material-addons/solid` | `Breadcrumb` | `onBeforechange`, `onChange` |

### Size

Measured as standalone minified ESM bundles, gzipped, with `material` external; the element's bundle also has the factory external. `scripts/breadcrumb-size.mjs` prints the row.

| Artifact | Gzip | Spec estimate |
| --- | ---: | ---: |
| Factory | 2,809 B | 1,800 B |
| Client elements | 1,310 B | 800 B |
| Compiled stylesheet | 933 B | 900 B |
| Combined | 5,052 B | 3,500 B |

## Alert

An inline callout for status notices, warnings and validation summaries. The four severities are info, success, warning and error: the first two use `role="status"` and the last two use `role="alert"`. The visual variants are tonal, outlined and filled.

<!-- example: run, shows "Update available" -->
```javascript
import 'material/styles';
import 'material-addons/styles';
import { createAlert } from 'material-addons/components/alert';

const alert = createAlert({
  severity: 'info',
  variant: 'tonal',
  label: 'Update available',
  supportingText: 'Restart to apply the new release.',
  action: 'Restart',
  dismissible: true,
});
document.body.append(alert.element);
```

Clicking the action button emits `action`. Clicking the close button or calling `dismiss()` runs a cancellable `beforedismiss` before hiding the callout; it then emits `dismiss`, and `show()` reveals the callout again. Set `noIcon: true` to omit the severity icon.

<!-- example: fragment -->
```html
<m-alert severity="error" variant="outlined" label="Submission failed" dismissible>
  Please check the highlighted fields before continuing.
</m-alert>
```

<!-- example: fragment -->
```javascript
import 'material-addons/elements/css/alert';
import { defineAlert } from 'material-addons/elements/alert';

defineAlert();
```

| Framework | Import | Component | Events |
| --- | --- | --- | --- |
| React | `material-addons/react` | `Alert` | `onAction`, `onBeforedismiss`, `onDismiss` |
| Vue | `material-addons/vue` | `MAlert` | `@action`, `@beforedismiss`, `@dismiss` |
| Svelte 5 | `material-addons/svelte` | `Alert` | `onaction`, `onbeforedismiss`, `ondismiss` |
| Solid | `material-addons/solid` | `Alert` | `onAction`, `onBeforedismiss`, `onDismiss` |

The adapters register `<m-alert>` and its shadow styles on the client. Each entry exports `AlertElementEventMap`.

### Size

Measured as standalone minified ESM bundles, gzipped, with `material` external; the element bundle keeps the factory external. `scripts/alert-size.mjs` prints the rows.

| Artifact | Measured | Target |
| --- | --- | --- |
| `createAlert` | 3.6 KB | 1.8 KB |
| `<m-alert>` | 1.1 KB | 0.9 KB |
| The compiled stylesheet | 1.5 KB | 1.1 KB |

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
| The form, the stepper, the autocomplete, the colour picker, the colour conversions, the expansion panel, the skeleton, the avatar and the alert, plus the layout and gestures | `material-addons` |
| The alert factory and types | `material-addons/components/alert` |
| The alert element and its shadow styles | `material-addons/elements/alert`, `material-addons/elements/css/alert` |
| The avatar factory and types | `material-addons/components/avatar` |
| The avatar element and its shadow styles | `material-addons/elements/avatar`, `material-addons/elements/css/avatar` |
| The autocomplete factory and types | `material-addons/components/autocomplete` |
| The autocomplete and option elements | `material-addons/elements/autocomplete` |
| The autocomplete's shadow styles | `material-addons/elements/css/autocomplete` |
| The pre-upgrade styles | `material-addons/elements/preupgrade.css` |
| The stepper factory | `material-addons/components/stepper` |
| The skeleton factory and types | `material-addons/components/skeleton` |
| The expansion panel factories | `material-addons/components/expansion-panel` |
| The layout | `material-addons/layout` |
| The gestures | `material-addons/gestures` |
| The same components, without the layout and gesture exports | `material-addons/components` |
| The React adapter | `material-addons/react` |
| The Vue adapter | `material-addons/vue` |
| The Solid adapter | `material-addons/solid` |
| The Svelte 5 adapter | `material-addons/svelte` |
| The stepper element | `material-addons/elements`, `material-addons/elements/stepper` |
| The skeleton element and its shadow styles | `material-addons/elements/skeleton`, `material-addons/elements/css/skeleton` |
| The paginator factory | `material-addons/components/paginator` |
| The paginator element and its shadow styles | `material-addons/elements/paginator`, `material-addons/elements/css/paginator` |
| The breadcrumb factory | `material-addons/components/breadcrumb` |
| The breadcrumb elements and their shadow styles | `material-addons/elements/breadcrumb`, `material-addons/elements/css/breadcrumb` |
| The expansion panel elements | `material-addons/elements/expansion-panel` |
| The stepper's shadow styles | `material-addons/elements/css/stepper` |
| The expansion panel's shadow styles | `material-addons/elements/css/expansion-panel` |
| A component's constants | `material-addons/components/form/constants`, `material-addons/components/colorpicker/constants`, `material-addons/components/autocomplete/constants`, `material-addons/components/stepper/constants`, `material-addons/components/expansion-panel/constants`, `material-addons/components/skeleton/constants`, `material-addons/components/avatar/constants`, `material-addons/components/alert/constants` |
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
bun run check:autocomplete  # autocomplete interactions and form behavior, in Chromium
bun run check:avatar        # avatar styles, native activation, and adapters, in Chromium
bun run check:alert         # alert severities, variants, dismiss lifecycle, and adapters, in Chromium
bun run check:stepper       # stepper focus and validation, in Chromium
bun run check:stepper-adapters # framework stepper bindings, in Chromium
bun run link:material       # use the material checkout in ../material
```

Some of them need something first.

- `check:package` compares the packed files with the release's list, so it needs the production build.
- The browser checks need a build and Chromium. Install Chromium with `npx playwright install chromium`.
- `link:material` needs `../material` to be built.

## Releasing

Until the trusted publisher is bound, publish by hand:

```bash
npm run release:pack
npm publish material-addons-<version>.tgz --access public
```

`release:pack` runs the types, tests, production build, packed package check and Chromium checks. `npm publish` tags a release `latest`. A pre-release passes `--tag next`.

Tag only on main: the release workflow refuses a `v*` tag whose commit is not on `origin/main`. A `v*` tag ruleset, so only the owner creates release tags, is recommended. The workflow creates the GitHub release as well, its notes taken from the released version's `CHANGELOG.md` section.

## Related

- [material](https://github.com/floor/material): the Material Design 3 component library this package extends.
- [md3.io](https://md3.io): the documentation and showcase site.

## License

MIT, see [LICENSE](LICENSE).
