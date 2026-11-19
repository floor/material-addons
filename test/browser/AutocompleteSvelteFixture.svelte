<script>
  import { Autocomplete, AutocompleteOption } from "material-addons/svelte";
  let value = $state(null);
</script>

<Autocomplete bind:value strict noOpenOnFocus oninput={window.record} onselect={window.record} onchange={window.record}>
  <AutocompleteOption value="ch" label="Switzerland" supportingText="Europe" />
  <AutocompleteOption value="jp" label="Japan" />
</Autocomplete>
<output>{value ?? ""}</output>
<button onclick={() => { value = "jp"; }}>Set Japan</button>
