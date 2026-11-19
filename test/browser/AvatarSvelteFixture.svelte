<script>
  import { Avatar } from "material-addons/svelte";
  let disabled = $state(false);
</script>

<Avatar variant="text" size="small" text="AL" label="Account" supportingText="Editor" {disabled} onclick={window.recordAvatarClick} />
<button onclick={() => { disabled = true; }}>Disable avatar</button>
<Avatar variant="text" text="A" ariaLabel="Presentational avatar" />
