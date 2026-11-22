<script>
  import { Rating } from "material-addons/svelte";
  let value = $state(2);
  const note = (kind) => (event) => { window.ratingLog.push([kind, event.detail.value]); };
</script>

<Rating half label="Quality" bind:value onchange={note("change")} onhover={note("hover")} />
<span id="bound">{value}</span>
<button onclick={() => { value = 2; }}>Set two</button>
