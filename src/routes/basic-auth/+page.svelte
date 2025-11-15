<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Eye, EyeOff } from 'lucide-svelte';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  let username = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let copied = $state<{ auth: boolean; header: boolean; curl: boolean }>({
    auth: false,
    header: false,
    curl: false
  });

  // 生成 Basic Auth 字符串
  let basicAuthString = $derived.by(() => {
    if (!username && !password) return '';
    const credentials = `${username || ''}:${password || ''}`;
    try {
      return btoa(credentials);
    } catch (e) {
      return '';
    }
  });

  // 生成完整的 Authorization 头部
  let authHeader = $derived.by(() => {
    if (!basicAuthString) return '';
    return `Authorization: Basic ${basicAuthString}`;
  });

  // 生成 cURL 命令示例
  let curlExample = $derived.by(() => {
    if (!basicAuthString) return '';
    return `curl -u "${username || ''}:${password || ''}" https://example.com/api`;
  });

  // 复制到剪贴板
  async function copyToClipboard(text: string, type: 'auth' | 'header' | 'curl') {
    if (!text) return;
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

  // 清空所有输入
  function clearAll() {
    username = '';
    password = '';
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <div class="card flex-1 flex flex-col">
    <div class="flex-1 flex flex-col space-y-6">
      <!-- 输入区域 -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('basicAuth.input')}
        </h2>
        
        <!-- 用户名 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('basicAuth.username')}
          </label>
          <input
            type="text"
            bind:value={username}
            placeholder={t('basicAuth.usernamePlaceholder')}
            class="input w-full"
          />
        </div>

        <!-- 密码 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('basicAuth.password')}
          </label>
          <div class="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              placeholder={t('basicAuth.passwordPlaceholder')}
              class="input w-full pr-10"
            />
            <button
              type="button"
              onclick={() => showPassword = !showPassword}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {#if showPassword}
                <EyeOff class="w-5 h-5" />
              {:else}
                <Eye class="w-5 h-5" />
              {/if}
            </button>
          </div>
        </div>

        <!-- 清空按钮 -->
        {#if username || password}
          <button
            onclick={clearAll}
            class="btn-secondary text-sm"
          >
            {t('basicAuth.clear')}
          </button>
        {/if}
      </div>

      <!-- 输出区域 -->
      {#if basicAuthString}
        <div class="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('basicAuth.output')}
          </h2>

          <!-- Base64 编码字符串 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('basicAuth.base64')}
              </label>
              <button
                onclick={() => copyToClipboard(basicAuthString, 'auth')}
                class="btn-secondary text-xs px-2 py-1"
                disabled={!basicAuthString}
              >
                {#if copied.auth}
                  <Check class="w-3 h-3" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>
            <div class="font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 border border-gray-200 dark:border-gray-700 break-all">
              {basicAuthString}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('basicAuth.base64Hint')}
            </p>
          </div>

          <!-- Authorization 头部 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('basicAuth.header')}
              </label>
              <button
                onclick={() => copyToClipboard(authHeader, 'header')}
                class="btn-secondary text-xs px-2 py-1"
                disabled={!authHeader}
              >
                {#if copied.header}
                  <Check class="w-3 h-3" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>
            <div class="font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 border border-gray-200 dark:border-gray-700 break-all">
              {authHeader}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('basicAuth.headerHint')}
            </p>
          </div>

          <!-- cURL 示例 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('basicAuth.curlExample')}
              </label>
              <button
                onclick={() => copyToClipboard(curlExample, 'curl')}
                class="btn-secondary text-xs px-2 py-1"
                disabled={!curlExample}
              >
                {#if copied.curl}
                  <Check class="w-3 h-3" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>
            <div class="font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 border border-gray-200 dark:border-gray-700 break-all">
              {curlExample}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('basicAuth.curlHint')}
            </p>
          </div>
        </div>
      {:else}
        <!-- 空状态提示 -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
            {t('basicAuth.placeholder')}
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

