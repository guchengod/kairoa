<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  let input = $state('');
  let output = $state('');
  let isEncoding = $state(true);
  let copied = $state(false);

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  function encode() {
    if (!input.trim()) {
      output = '';
      return;
    }

    try {
      output = encodeURIComponent(input);
    } catch (error) {
      output = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  function decode() {
    if (!input.trim()) {
      output = '';
      return;
    }

    try {
      output = decodeURIComponent(input);
    } catch (error) {
      output = `Error: ${error instanceof Error ? error.message : 'Invalid URL encoding'}`;
    }
  }

  async function copyToClipboard() {
    const text = output || input;
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clear() {
    input = '';
    output = '';
  }

  $effect(() => {
    if (input) {
      if (isEncoding) {
        encode();
      } else {
        decode();
      }
    }
  });
</script>

<div class="max-w-4xl mx-auto p-8">
  <div class="card">
    <h2 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
      {t('nav.url')}
    </h2>

    <div class="space-y-4">
      <div class="flex gap-2">
        <button
          class="px-4 py-2 rounded-lg transition-colors {isEncoding
            ? 'bg-primary-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}"
          onclick={() => { isEncoding = true; encode(); }}
        >
          Encode
        </button>
        <button
          class="px-4 py-2 rounded-lg transition-colors {!isEncoding
            ? 'bg-primary-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}"
          onclick={() => { isEncoding = false; decode(); }}
        >
          Decode
        </button>
      </div>

      <div>
        <label for="url-input" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Input
        </label>
        <textarea
          id="url-input"
          bind:value={input}
          placeholder={isEncoding ? 'Enter text to encode...' : 'Enter URL encoded text...'}
          class="textarea h-32"
          oninput={isEncoding ? encode : decode}
        ></textarea>
      </div>

      {#if output}
        <div>
          <label for="url-output" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Output
          </label>
          <div class="flex gap-2">
            <textarea
              id="url-output"
              value={output}
              readonly
              class="textarea h-32 font-mono text-sm flex-1"
            ></textarea>
            <button
              onclick={copyToClipboard}
              class="btn-secondary whitespace-nowrap"
            >
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        </div>
      {/if}

      <div class="flex gap-2">
        <button onclick={clear} class="btn-secondary">
          {t('common.clear')}
        </button>
      </div>
    </div>
  </div>
</div>

