<script lang="ts">
  import { Breadcrumb } from "material-addons/svelte";
</script>

<Breadcrumb onbeforechange={window.recordBefore} onchange={window.recordChange}>
  <m-breadcrumb-item value="home">Home</m-breadcrumb-item>
  <m-breadcrumb-item value="rooms">Rooms</m-breadcrumb-item>
  <m-breadcrumb-item value="chair">Chair</m-breadcrumb-item>
</Breadcrumb>
