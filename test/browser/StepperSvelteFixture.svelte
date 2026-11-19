<script>
  import { Stepper, Step } from "material-addons/svelte";
  let value = $state("one");
</script>

<Stepper bind:value display={value === "one" ? "count" : "dots"} onbeforechange={window.recordBefore} onchange={window.recordChange}>
  <Step value="one" label="One" supportingText="First">First panel</Step>
  <Step value="two" label="Two">Second panel</Step>
</Stepper>
<output>{value}</output>
