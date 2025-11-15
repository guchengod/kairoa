<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Keyboard } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  interface KeyInfo {
    key: string;
    code: string;
    keyCode: number;
    which: number;
    location: number;
    altKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    timestamp: number;
  }

  let keyInfo = $state<KeyInfo | null>(null);
  let copied = $state<{ key: boolean; code: boolean; keyCode: boolean; json: boolean }>({
    key: false,
    code: false,
    keyCode: false,
    json: false
  });
  let isListening = $state(false);

  function handleKeyDown(e: KeyboardEvent) {
    if (!isListening) return;
    
    e.preventDefault();
    e.stopPropagation();

    keyInfo = {
      key: e.key || '',
      code: e.code || '',
      keyCode: e.keyCode || 0,
      which: (e as any).which || e.keyCode || 0,
      location: e.location || 0,
      altKey: e.altKey || false,
      ctrlKey: e.ctrlKey || false,
      shiftKey: e.shiftKey || false,
      metaKey: e.metaKey || false,
      timestamp: Date.now()
    };
  }

  function handleKeyUp(e: KeyboardEvent) {
    // 可以在这里处理按键释放事件
  }

  onMount(() => {
    // 组件挂载时自动开始监听
    isListening = true;
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  async function copyToClipboard(text: string, type: 'key' | 'code' | 'keyCode' | 'json') {
    try {
      await navigator.clipboard.writeText(text);
      copied = { ...copied, [type]: true };
      setTimeout(() => {
        copied = { ...copied, [type]: false };
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function getLocationName(location: number): string {
    const locations: Record<number, string> = {
      0: t('keycode.location.standard'),
      1: t('keycode.location.left'),
      2: t('keycode.location.right'),
      3: t('keycode.location.numpad')
    };
    return locations[location] || t('keycode.location.unknown');
  }

  let keyInfoJson = $derived.by(() => {
    if (!keyInfo) return '';
    try {
      return JSON.stringify(keyInfo, null, 2);
    } catch (e) {
      return '';
    }
  });

  function clearInfo() {
    keyInfo = null;
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <div class="card flex-1 flex flex-col">
    <!-- 控制区域 -->
    <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={isListening}
            class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-400 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {t('keycode.listening')}
          </span>
        </label>
        {#if keyInfo}
          <button
            onclick={clearInfo}
            class="btn-secondary text-sm px-3 py-1"
          >
            {t('keycode.clear')}
          </button>
        {/if}
      </div>
    </div>

    <!-- 按键信息显示区域 -->
    {#if keyInfo}
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-auto">
        <!-- 左侧：基本信息 -->
        <div class="space-y-4">
          <!-- Key -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('keycode.key')}
              </label>
              <button
                onclick={() => copyToClipboard(keyInfo.key, 'key')}
                class="btn-secondary text-xs px-2 py-1"
              >
                {#if copied.key}
                  <Check class="w-3 h-3" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>
            <div class="font-mono text-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2">
              {keyInfo.key || t('keycode.empty')}
            </div>
          </div>

          <!-- Code -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('keycode.code')}
              </label>
              <button
                onclick={() => copyToClipboard(keyInfo.code, 'code')}
                class="btn-secondary text-xs px-2 py-1"
              >
                {#if copied.code}
                  <Check class="w-3 h-3" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>
            <div class="font-mono text-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2">
              {keyInfo.code || t('keycode.empty')}
            </div>
          </div>

          <!-- KeyCode -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('keycode.keyCode')}
              </label>
              <button
                onclick={() => copyToClipboard(keyInfo.keyCode.toString(), 'keyCode')}
                class="btn-secondary text-xs px-2 py-1"
              >
                {#if copied.keyCode}
                  <Check class="w-3 h-3" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>
            <div class="font-mono text-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2">
              {keyInfo.keyCode}
            </div>
          </div>

          <!-- Which -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              {t('keycode.which')}
            </label>
            <div class="font-mono text-lg text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2">
              {keyInfo.which}
            </div>
          </div>

          <!-- Location -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              {t('keycode.location.label')}
            </label>
            <div class="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2">
              {getLocationName(keyInfo.location)} ({keyInfo.location})
            </div>
          </div>
        </div>

        <!-- 右侧：修饰键和 JSON -->
        <div class="space-y-4">
          <!-- 修饰键 -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
              {t('keycode.modifiers')}
            </label>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keyInfo.altKey}
                  disabled
                  class="w-4 h-4"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {t('keycode.altKey')}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keyInfo.ctrlKey}
                  disabled
                  class="w-4 h-4"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {t('keycode.ctrlKey')}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keyInfo.shiftKey}
                  disabled
                  class="w-4 h-4"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {t('keycode.shiftKey')}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keyInfo.metaKey}
                  disabled
                  class="w-4 h-4"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {t('keycode.metaKey')}
                </span>
              </div>
            </div>
          </div>

          <!-- JSON 输出 -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex-1 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('keycode.json')}
              </label>
              <button
                onclick={() => copyToClipboard(keyInfoJson, 'json')}
                class="btn-secondary text-xs px-2 py-1"
              >
                {#if copied.json}
                  <Check class="w-3 h-3" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>
            <pre class="flex-1 font-mono text-xs text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded p-3 overflow-auto">{keyInfoJson}</pre>
          </div>
        </div>
      </div>
    {:else}
      <!-- 空状态 -->
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center text-gray-400 dark:text-gray-500">
          <Keyboard class="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p class="text-sm">
            {t('keycode.placeholder')}
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

