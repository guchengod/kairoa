<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, RefreshCw, Trash2 } from 'lucide-svelte';
  import { format } from 'sql-formatter';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  let inputSql = $state('');
  let formattedSql = $state('');
  let copied = $state(false);
  let error = $state('');

  // 格式化选项
  let options = $state({
    language: 'sql',
    indentType: 'spaces' as 'spaces' | 'tab',
    indentSize: 2,
    keywordCase: 'upper' as 'upper' | 'lower'
  });

  function formatSql() {
    error = '';
    formattedSql = '';
    
    if (!inputSql.trim()) {
      return;
    }

    try {
      const formatOptions: any = {
        language: options.language,
        keywordCase: options.keywordCase
      };

      // 根据缩进类型设置 tabWidth
      if (options.indentType === 'tab') {
        formatOptions.useTabs = true;
        formatOptions.tabWidth = 1; // 使用制表符时，tabWidth 设为 1
      } else {
        formatOptions.useTabs = false;
        formatOptions.tabWidth = options.indentSize;
      }

      formattedSql = format(inputSql, formatOptions);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      formattedSql = '';
    }
  }

  // 自动格式化：当输入或选项改变时自动格式化
  $effect(() => {
    // 访问所有需要监听的响应式状态
    const sql = inputSql;
    const indentType = options.indentType;
    const indentSize = options.indentSize;
    const keywordCase = options.keywordCase;
    
    if (sql.trim()) {
      formatSql();
    } else {
      formattedSql = '';
      error = '';
    }
  });

  async function copyToClipboard(text: string) {
    if (!text) return;
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
    inputSql = '';
    formattedSql = '';
    error = '';
  }
</script>

<div class="ml-0 mr-0 p-2">
  <div class="max-w-7xl mx-auto">
    <!-- 格式化选项 -->
    <div class="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('sqlFormatter.options')}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 缩进类型和大小 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('sqlFormatter.indentSize')}
          </label>
          <select
            bind:value={options.indentType}
            class="input w-full text-sm mb-2"
          >
            <option value="spaces">{t('sqlFormatter.spaces')}</option>
            <option value="tab">{t('sqlFormatter.tab')}</option>
          </select>
          {#if options.indentType === 'spaces'}
            <select
              bind:value={options.indentSize}
              class="input w-full text-sm"
            >
              <option value={2}>{t('sqlFormatter.twoSpaces')}</option>
              <option value={4}>{t('sqlFormatter.fourSpaces')}</option>
            </select>
          {/if}
        </div>
        
        <!-- 关键字大小写 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('sqlFormatter.keywordCase')}
          </label>
          <select
            bind:value={options.keywordCase}
            class="input w-full text-sm"
          >
            <option value="upper">{t('sqlFormatter.uppercase')}</option>
            <option value="lower">{t('sqlFormatter.lowercase')}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 输入输出区域 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 输入区域 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('sqlFormatter.input')}</h3>
          <button
            onclick={clearAll}
            class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title={t('sqlFormatter.clear')}
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
        <div class="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <textarea
            bind:value={inputSql}
            placeholder={t('sqlFormatter.inputPlaceholder')}
            class="w-full px-4 py-3 border-none dark:border-none bg-transparent text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-0 resize-none h-[500px]"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <!-- 输出区域 -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('sqlFormatter.output')}</h3>
          {#if formattedSql}
            <button
              onclick={() => copyToClipboard(formattedSql)}
              class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title={t('sqlFormatter.copy')}
            >
              {#if copied}
                <Check class="w-4 h-4" />
              {:else}
                <Copy class="w-4 h-4" />
              {/if}
            </button>
          {/if}
        </div>
        
        <!-- 错误提示 -->
        {#if error}
          <div class="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-600 dark:text-red-400 font-mono">{error}</p>
          </div>
        {/if}
        
        <div class="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          {#if formattedSql}
            <pre class="w-full px-4 py-3 text-gray-900 dark:text-gray-100 font-mono text-sm overflow-auto h-[500px] whitespace-pre-wrap break-words">{formattedSql}</pre>
          {:else}
            <div class="w-full px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-sm h-[500px] flex items-center justify-center">
              {t('sqlFormatter.outputPlaceholder')}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>