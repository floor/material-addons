<script>
  import { NavigationTabs } from "material-addons/svelte";
</script>

<NavigationTabs ariaLabel="Adapter navigation" current="#overview" onchange={window.recordNavigation}>
  <a href="#overview">Overview</a>
  <a href="#matrix">Matrix</a>
</NavigationTabs>
