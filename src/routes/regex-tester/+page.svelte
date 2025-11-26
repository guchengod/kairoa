<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Trash2, BookOpen } from 'lucide-svelte';
  import { browser } from '$app/environment';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  let pattern = $state('');
  let testText = $state('');
  let flags = $state({
    global: true,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
    unicode: false,
    sticky: false
  });

  let matches = $state<Array<{ match: string; index: number; groups: string[] }>>([]);
  let error = $state('');
  let copied = $state(false);

  // 常用正则表达式示例
  const examples = [
    { name: 'Email', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', flags: { global: false, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } },
    { name: 'URL', pattern: 'https?://[\\w\\-]+(\\.[\\w\\-]+)+([\\w\\-\\.,@?^=%&:/~\\+#]*[\\w\\-\\@?^=%&/~\\+#])?', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } },
    { name: 'IPv4', pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } },
    { name: 'Phone (US)', pattern: '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } },
    { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } },
    { name: 'Credit Card', pattern: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } },
    { name: 'Hex Color', pattern: '#[0-9A-Fa-f]{6}', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } },
    { name: 'Chinese Characters', pattern: '[\\u4e00-\\u9fa5]+', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: true, sticky: false } },
    { name: 'Numbers Only', pattern: '^\\d+$', flags: { global: false, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false } },
    { name: 'Word Boundaries', pattern: '\\b\\w+\\b', flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false } }
  ];

  function testRegex() {
    error = '';
    matches = [];

    if (!pattern.trim()) {
      return;
    }

    try {
      let flagString = '';
      if (flags.global) flagString += 'g';
      if (flags.ignoreCase) flagString += 'i';
      if (flags.multiline) flagString += 'm';
      if (flags.dotAll) flagString += 's';
      if (flags.unicode) flagString += 'u';
      if (flags.sticky) flagString += 'y';

      const regex = new RegExp(pattern, flagString);
      
      if (flags.global) {
        // 使用 matchAll 获取所有匹配
        const allMatches = Array.from(testText.matchAll(regex));
        matches = allMatches.map(m => ({
          match: m[0],
          index: m.index!,
          groups: m.slice(1)
        }));
      } else {
        // 只匹配第一个
        const match = testText.match(regex);
        if (match) {
          matches = [{
            match: match[0],
            index: match.index!,
            groups: match.slice(1)
          }];
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // 当模式或标志改变时自动测试
  $effect(() => {
    if (pattern && testText) {
      testRegex();
    }
  });

  function highlightText(text: string): string {
    if (!pattern || !text || matches.length === 0) {
      return escapeHtml(text);
    }

    let result = '';
    let lastIndex = 0;

    // 按索引排序匹配
    const sortedMatches = [...matches].sort((a, b) => a.index - b.index);

    for (const match of sortedMatches) {
      // 添加匹配前的文本
      result += escapeHtml(text.substring(lastIndex, match.index));
      // 添加高亮的匹配文本
      result += `<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">${escapeHtml(match.match)}</mark>`;
      lastIndex = match.index + match.match.length;
    }

    // 添加剩余的文本
    result += escapeHtml(text.substring(lastIndex));

    return result;
  }

  function escapeHtml(text: string): string {
    if (!browser) {
      // SSR fallback
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function loadExample(example: typeof examples[0]) {
    pattern = example.pattern;
    flags = { ...example.flags };
    testRegex();
  }

  async function copyToClipboard(text: string) {
    if (!browser) return;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function clearAll() {
    pattern = '';
    testText = '';
    matches = [];
    error = '';
  }
</script>

<div class="ml-0 mr-0 p-2">
  <div class="max-w-7xl mx-auto">


    <!-- 常用示例 -->
    <div class="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div class="flex items-center gap-2 mb-3">
        <BookOpen class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('regexTester.examples')}</h3>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each examples as example}
          <button
            onclick={() => loadExample(example)}
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {example.name}
          </button>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 左侧：输入区域 -->
      <div class="space-y-4">
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <!-- 正则表达式输入 -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('regexTester.pattern')}
            </label>
            <textarea
              bind:value={pattern}
              placeholder={t('regexTester.patternPlaceholder')}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="2"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
            ></textarea>
          </div>

          <!-- 标志选项 -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('regexTester.flags')}
            </label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={flags.global}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">g</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">全局匹配</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={flags.ignoreCase}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">i</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">忽略大小写</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={flags.multiline}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">m</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">多行模式</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={flags.dotAll}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">s</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">点匹配所有</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={flags.unicode}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">u</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">Unicode 模式</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={flags.sticky}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">y</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">粘性匹配</span>
              </label>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-2">
            <button
              onclick={testRegex}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('regexTester.test')}
            </button>
            <button
              onclick={clearAll}
              class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <Trash2 class="w-4 h-4" />
              {t('regexTester.clear')}
            </button>
          </div>

          <!-- 错误提示 -->
          {#if error}
            <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-600 dark:text-red-400 font-mono">{error}</p>
            </div>
          {/if}
        </div>

        <!-- 测试文本输入 -->
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('regexTester.testText')}
          </label>
          <textarea
            bind:value={testText}
            placeholder={t('regexTester.testTextPlaceholder')}
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows="10"
          ></textarea>
        </div>
      </div>

      <!-- 右侧：结果区域 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col h-full">
        <!-- 顶部：结果统计 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('regexTester.results')}</h3>
            <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
              {matches.length} {matches.length === 1 ? t('regexTester.match') : t('regexTester.matches')}
            </span>
          </div>
          {#if testText}
            <button
              onclick={() => copyToClipboard(testText)}
              class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title={t('regexTester.copy')}
            >
              {#if copied}
                <Check class="w-4 h-4" />
              {:else}
                <Copy class="w-4 h-4" />
              {/if}
            </button>
          {/if}
        </div>
        
        <!-- 内容区域：合并显示 -->
        <div class="flex-1 overflow-hidden">
          {#if testText}
            <!-- 高亮文本 -->
            <div class="mb-4">
              <div
                class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 font-mono text-sm whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto"
              >
                {@html highlightText(testText)}
              </div>
            </div>
          {/if}
          
          <!-- 匹配详情 -->
          {#if matches.length > 0}
            <div class="flex-1 overflow-hidden">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">{t('regexTester.matches')}</h4>
                <span class="text-xs text-gray-500 dark:text-gray-400">{matches.length} {t('regexTester.items')}</span>
              </div>
              <div class="space-y-2 h-full overflow-y-auto">
                {#each matches as match, index}
                  <div class="p-2 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-600">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>#{index + 1}</span>
                          <span>•</span>
                          <span>{t('regexTester.at')} {match.index}</span>
                        </div>
                        <code class="text-sm text-gray-900 dark:text-gray-100 break-all bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 block">{match.match}</code>
                        {#if match.groups.length > 0}
                          <div class="mt-1 text-xs">
                            <div class="flex flex-wrap gap-1">
                              {#each match.groups as group, gIndex}
                                <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{group || '(empty)'}</code>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      </div>
                      <button
                        onclick={() => copyToClipboard(match.match)}
                        class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 mt-1"
                        title={t('regexTester.copy')}
                      >
                        {#if copied}
                          <Check class="w-3 h-3" />
                        {:else}
                          <Copy class="w-3 h-3" />
                        {/if}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else if testText}
            <div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
              {t('regexTester.noMatches')}
            </div>
          {:else}
            <div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
              {t('regexTester.enterTestText')}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

