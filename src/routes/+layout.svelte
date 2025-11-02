<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import { locale } from '$lib/stores/i18n';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import '../app.css';

  onMount(() => {
    theme.init();
    locale.init();
  });
</script>

<div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
  <Sidebar />
  <main class="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
    <slot />
  </main>
</div>
