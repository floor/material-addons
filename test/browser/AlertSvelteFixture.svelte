<script>
  import { Alert } from "material-addons/svelte";
</script>

<Alert
  severity="warning"
  variant="tonal"
  label="Quota warning"
  supportingText="90% of storage used"
  action="Upgrade"
  dismissible
  onaction={window.recordAlertAction}
  onbeforedismiss={window.recordAlertBeforeDismiss}
  ondismiss={window.recordAlertDismiss}
/>
