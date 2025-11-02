<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  let input = $state('');
  let error = $state('');
  let copied = $state(false);
  let cleared = $state(false);

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  function formatJSON() {
    if (!input.trim()) {
      error = '';
      return;
    }

    try {
      const parsed = JSON.parse(input);
      input = JSON.stringify(parsed, null, 2);
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  function minifyJSON() {
    if (!input.trim()) {
      error = '';
      return;
    }

    try {
      const parsed = JSON.parse(input);
      input = JSON.stringify(parsed);
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  async function copyToClipboard() {
    const text = input;
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clear() {
    input = '';
    error = '';
    cleared = true;
    setTimeout(() => {
      cleared = false;
    }, 1000);
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <div class="card flex-1 flex flex-col">
    <div class="flex-1 flex flex-col space-y-4">
      <div class="flex-1 flex flex-col">
        <textarea
          id="json-input"
          bind:value={input}
          placeholder='{`{"example": "json"}`}'
          class="textarea flex-1 font-mono text-sm resize-none"
        ></textarea>
      </div>

      {#if error}
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      {/if}

      <div class="flex gap-2">
        <button onclick={formatJSON} class="px-4 py-2 rounded-lg transition-colors font-medium text-white" style="background-color: #818089;">
          Format
        </button>
        <button onclick={minifyJSON} class="px-4 py-2 rounded-lg transition-colors font-medium text-white" style="background-color: #030213;">
          Minify
        </button>
        <button onclick={copyToClipboard} class="btn-secondary transition-all duration-200 {copied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}">
          {#if copied}
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              {t('common.copied')}
            </span>
          {:else}
            {t('common.copy')}
          {/if}
        </button>
        <button onclick={clear} class="btn-secondary transition-all duration-200 {cleared ? 'bg-green-500 hover:bg-green-600 text-white' : ''}">
          {#if cleared}
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              已清空！
            </span>
          {:else}
            清空
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

