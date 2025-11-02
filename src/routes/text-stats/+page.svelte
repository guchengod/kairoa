<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  let input = $state('');
  
  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  interface TextStats {
    charactersWithSpaces: number;
    charactersWithoutSpaces: number;
    words: number;
    lines: number;
    paragraphs: number;
    chineseCharacters: number;
    englishCharacters: number;
    numbers: number;
    punctuation: number;
  }

  function calculateStats(text: string): TextStats {
    const charactersWithSpaces = text.length;
    const charactersWithoutSpaces = text.replace(/\s/g, '').length;
    
    // 单词数：英文按空格分隔，中文按字符统计
    // 对于混合文本：统计英文单词数（按空格分隔）+ 中文字符数（单独统计）
    let words = 0;
    if (text.trim() !== '') {
      // 英文单词：按空格分隔
      const englishWords = text.trim().split(/\s+/).filter(word => {
        // 只统计包含英文字母的单词
        return /[a-zA-Z]/.test(word);
      }).length;
      
      // 中文字符数（每个中文字符算作一个"词"）
      const chineseWordCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
      
      words = englishWords + chineseWordCount;
    }
    
    // 行数
    const lines = text === '' ? 0 : text.split('\n').length;
    
    // 段落数（按空行分隔）
    const paragraphs = text.trim() === '' ? 0 : text.trim().split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    
    // 中文字符数（包括中文标点）
    const chineseCharacters = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
    
    // 英文字符数
    const englishCharacters = (text.match(/[a-zA-Z]/g) || []).length;
    
    // 数字
    const numbers = (text.match(/[0-9]/g) || []).length;
    
    // 标点符号
    const punctuation = (text.match(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
    
    return {
      charactersWithSpaces,
      charactersWithoutSpaces,
      words,
      lines,
      paragraphs,
      chineseCharacters,
      englishCharacters,
      numbers,
      punctuation
    };
  }

  let stats = $derived(calculateStats(input));

  function clear() {
    input = '';
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }
</script>

<div class="w-full ml-0 mr-0 p-2 space-y-6">
  <!-- 输入区域卡片 -->
  <div class="card">
    <div class="space-y-4">
      <textarea
        bind:value={input}
        placeholder={t('textStats.placeholder')}
        class="input font-mono text-sm min-h-32 resize-none"
        rows="5"
      ></textarea>

      <div class="flex gap-2">
        <button onclick={clear} class="btn-secondary">
          {t('textStats.clear')}
        </button>
      </div>
    </div>
  </div>

  <!-- 统计结果卡片 -->
  <div class="card">
    <div class="space-y-4">
      <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        {t('textStats.statistics')}
      </h3>
      
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <!-- 字符数（含空格） -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.charactersWithSpaces')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.charactersWithSpaces.toLocaleString()}
          </div>
        </div>

        <!-- 字符数（不含空格） -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.charactersWithoutSpaces')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.charactersWithoutSpaces.toLocaleString()}
          </div>
        </div>

        <!-- 单词数 -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.words')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.words.toLocaleString()}
          </div>
        </div>

        <!-- 行数 -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.lines')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.lines.toLocaleString()}
          </div>
        </div>

        <!-- 段落数 -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.paragraphs')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.paragraphs.toLocaleString()}
          </div>
        </div>

        <!-- 中文字符数 -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.chineseCharacters')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.chineseCharacters.toLocaleString()}
          </div>
        </div>

        <!-- 英文字符数 -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.englishCharacters')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.englishCharacters.toLocaleString()}
          </div>
        </div>

        <!-- 数字 -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.numbers')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.numbers.toLocaleString()}
          </div>
        </div>

        <!-- 标点符号 -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('textStats.punctuation')}
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.punctuation.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

