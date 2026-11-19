<script lang="ts">
  import { Accordion, ExpansionPanel } from "material-addons/svelte";
  let value = $state("one");
</script>

<Accordion bind:value onchange={window.recordChange}>
  <ExpansionPanel value="one" label="One" onbeforeopen={window.recordBefore} onchange={window.recordChange}>
    First body
  </ExpansionPanel>
  <ExpansionPanel value="two" label="Two">Second body</ExpansionPanel>
</Accordion>
<output>{value}</output>
