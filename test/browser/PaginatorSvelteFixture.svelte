<script lang="ts">
  import { Paginator } from "material-addons/svelte";
</script>

<Paginator total={100} page={1} onchange={window.recordChange} />
<output>{window.events.length}</output>
