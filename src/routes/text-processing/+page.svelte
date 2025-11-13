<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Trash2, FileText } from 'lucide-svelte';
  import { page } from '$app/stores';
  
  type ToolType = 'stats' | 'diff' | 'case';
  
  let toolType = $state<ToolType>('stats');
  
  // Check URL parameter for type
  $effect(() => {
    const typeParam = $page.url.searchParams.get('type');
    if (typeParam === 'stats' || typeParam === 'diff' || typeParam === 'case') {
      toolType = typeParam as ToolType;
    }
  });
  
  function switchToolType(type: ToolType) {
    toolType = type;
  }
  
  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // Text Stats related code
  let input = $state('');

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

  function clearStats() {
    input = '';
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // Text Diff related code
  let text1 = $state('');
  let text2 = $state('');
  let copied = $state<{ old: boolean; new: boolean }>({ old: false, new: false });

  interface DiffLine {
    type: 'equal' | 'delete' | 'insert' | 'modify';
    oldLine: string;
    newLine: string;
    oldLineNumber: number | null;
    newLineNumber: number | null;
  }

  // 简单的文本差异算法（基于行）
  function computeDiff(text1: string, text2: string): DiffLine[] {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const diff: DiffLine[] = [];
    
    let i = 0, j = 0;
    let oldLineNum = 1, newLineNum = 1;

    while (i < lines1.length || j < lines2.length) {
      if (i >= lines1.length) {
        // 只剩下 text2 的内容
        diff.push({
          type: 'insert',
          oldLine: '',
          newLine: lines2[j],
          oldLineNumber: null,
          newLineNumber: newLineNum++
        });
        j++;
      } else if (j >= lines2.length) {
        // 只剩下 text1 的内容
        diff.push({
          type: 'delete',
          oldLine: lines1[i],
          newLine: '',
          oldLineNumber: oldLineNum++,
          newLineNumber: null
        });
        i++;
      } else if (lines1[i] === lines2[j]) {
        // 相同的行
        diff.push({
          type: 'equal',
          oldLine: lines1[i],
          newLine: lines2[j],
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++
        });
        i++;
        j++;
      } else {
        // 检查是否是修改（下一行匹配）还是删除/插入
        let foundMatch = false;
        
        // 检查 text2 的后续行是否有匹配
        for (let k = j + 1; k < Math.min(j + 5, lines2.length); k++) {
          if (lines1[i] === lines2[k]) {
            // text2 中跳过了几行，这些是插入的
            for (let l = j; l < k; l++) {
              diff.push({
                type: 'insert',
                oldLine: '',
                newLine: lines2[l],
                oldLineNumber: null,
                newLineNumber: newLineNum++
              });
            }
            j = k;
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          // 检查 text1 的后续行是否有匹配
          for (let k = i + 1; k < Math.min(i + 5, lines1.length); k++) {
            if (lines1[k] === lines2[j]) {
              // text1 中跳过了几行，这些是删除的
              for (let l = i; l < k; l++) {
                diff.push({
                  type: 'delete',
                  oldLine: lines1[l],
                  newLine: '',
                  oldLineNumber: oldLineNum++,
                  newLineNumber: null
                });
              }
              i = k;
              foundMatch = true;
              break;
            }
          }
        }
        
        if (!foundMatch) {
          // 没有找到匹配，标记为修改
          diff.push({
            type: 'modify',
            oldLine: lines1[i],
            newLine: lines2[j],
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++
          });
          i++;
          j++;
        }
      }
    }
    
    return diff;
  }

  let diff = $derived(computeDiff(text1, text2));

  function getLineClass(type: string, side: 'old' | 'new'): string {
    if (type === 'equal') {
      return 'bg-white dark:bg-gray-800';
    } else if (type === 'delete') {
      return side === 'old' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-900';
    } else if (type === 'insert') {
      return side === 'old' ? 'bg-gray-50 dark:bg-gray-900' : 'bg-green-100 dark:bg-green-900/30';
    } else if (type === 'modify') {
      return side === 'old' ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30';
    }
    return '';
  }

  function getLineBorderClass(type: string): string {
    if (type === 'delete') {
      return 'border-l-4 border-red-500 dark:border-red-400';
    } else if (type === 'insert') {
      return 'border-l-4 border-green-500 dark:border-green-400';
    } else if (type === 'modify') {
      return 'border-l-4 border-yellow-500 dark:border-yellow-400';
    }
    return '';
  }

  async function copyToClipboardDiff(text: string, side: 'old' | 'new') {
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      copied = { ...copied, [side]: true };
      setTimeout(() => {
        copied = { ...copied, [side]: false };
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clearDiff() {
    text1 = '';
    text2 = '';
    copied = { old: false, new: false };
  }

  // Case Converter related code
  type CaseType = 'uppercase' | 'lowercase' | 'titleCase' | 'sentenceCase' | 'camelCase' | 'pascalCase' | 'snakeCase' | 'kebabCase' | 'constantCase' | 'dotCase' | 'pathCase' | 'trainCase' | 'cobolCase' | 'flatCase' | 'alternatingCase' | 'randomCase';
  
  let caseInput = $state('');
  let caseType = $state<CaseType>('uppercase');
  let caseOutput = $state('');
  let caseCopied = $state(false);

  function convertCase(text: string, type: CaseType): string {
    if (!text) return '';
    
    switch (type) {
      case 'uppercase':
        return text.toUpperCase();
      
      case 'lowercase':
        return text.toLowerCase();
      
      case 'titleCase':
        return text
          .toLowerCase()
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      
      case 'sentenceCase':
        return text
          .toLowerCase()
          .split(/([.!?]\s+|^)/)
          .map((sentence, index) => {
            if (index === 0 || /[.!?]\s+/.test(sentence)) {
              return sentence.charAt(0).toUpperCase() + sentence.slice(1);
            }
            return sentence;
          })
          .join('');
      
      case 'camelCase':
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase())
          .replace(/^[A-Z]/, char => char.toLowerCase());
      
      case 'pascalCase':
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase())
          .replace(/^[a-z]/, char => char.toUpperCase());
      
      case 'snakeCase':
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      
      case 'kebabCase':
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      
      case 'constantCase':
        return text
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      
      case 'dotCase':
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.+|\.+$/g, '');
      
      case 'pathCase':
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '/')
          .replace(/^\/+|\/+$/g, '');
      
      case 'trainCase':
        return text
          .toLowerCase()
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join('-')
          .replace(/[^A-Za-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      
      case 'cobolCase':
        return text
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      
      case 'flatCase':
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '');
      
      case 'alternatingCase':
        return text
          .split('')
          .map((char, index) => {
            if (!/[a-zA-Z]/.test(char)) return char;
            return index % 2 === 0 ? char.toLowerCase() : char.toUpperCase();
          })
          .join('');
      
      case 'randomCase':
        return text
          .split('')
          .map(char => {
            if (!/[a-zA-Z]/.test(char)) return char;
            return Math.random() < 0.5 ? char.toLowerCase() : char.toUpperCase();
          })
          .join('');
      
      default:
        return text;
    }
  }

  $effect(() => {
    caseOutput = convertCase(caseInput, caseType);
  });

  async function copyCaseToClipboard() {
    if (!caseOutput) return;
    
    try {
      await navigator.clipboard.writeText(caseOutput);
      caseCopied = true;
      setTimeout(() => {
        caseCopied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clearCase() {
    caseInput = '';
    caseOutput = '';
    caseCopied = false;
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <!-- 工具类型切换 -->
  <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
    <div class="flex gap-6">
      <button
        onclick={() => switchToolType('stats')}
        class="px-4 py-2 relative transition-colors font-medium {toolType === 'stats'
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        {t('textStats.title')}
        {#if toolType === 'stats'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"></span>
        {/if}
      </button>
      <button
        onclick={() => switchToolType('diff')}
        class="px-4 py-2 relative transition-colors font-medium {toolType === 'diff'
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        {t('textDiff.title')}
        {#if toolType === 'diff'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"></span>
        {/if}
      </button>
      <button
        onclick={() => switchToolType('case')}
        class="px-4 py-2 relative transition-colors font-medium {toolType === 'case'
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        {t('textCase.title')}
        {#if toolType === 'case'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"></span>
        {/if}
      </button>
    </div>
  </div>

  <!-- 文本统计 -->
  {#if toolType === 'stats'}
    <div class="flex-1 flex flex-col space-y-6 min-h-0">
      <!-- 输入区域卡片 -->
      <div class="card flex-shrink-0">
        <div class="space-y-4">
          <textarea
            bind:value={input}
            placeholder={t('textStats.placeholder')}
            class="input font-mono text-sm min-h-32 resize-none"
            rows="5"
          ></textarea>

          <div class="flex gap-2">
            <button onclick={clearStats} class="btn-secondary">
              {t('textStats.clear')}
            </button>
          </div>
        </div>
      </div>

      <!-- 统计结果卡片 -->
      <div class="card flex-1 min-h-0 overflow-y-auto">
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
  {/if}

  <!-- 文本差异对比 -->
  {#if toolType === 'diff'}
    <div class="flex-1 flex flex-col min-h-0">
      <!-- 输入区域 -->
      <div class="card flex-shrink-0 mb-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 原始文本 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('textDiff.oldText')}
              </label>
              <button
                onclick={() => copyToClipboardDiff(text1, 'old')}
                class="btn-secondary text-sm transition-all duration-200 {copied.old ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
              >
                {#if copied.old}
                  <Check class="w-4 h-4 inline mr-1" />
                  {t('common.copied')}
                {:else}
                  <Copy class="w-4 h-4 inline mr-1" />
                  {t('common.copy')}
                {/if}
              </button>
            </div>
            <textarea
              bind:value={text1}
              placeholder={t('textDiff.oldTextPlaceholder')}
              class="textarea font-mono text-sm min-h-[150px]"
            ></textarea>
          </div>

          <!-- 新文本 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('textDiff.newText')}
              </label>
              <button
                onclick={() => copyToClipboardDiff(text2, 'new')}
                class="btn-secondary text-sm transition-all duration-200 {copied.new ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
              >
                {#if copied.new}
                  <Check class="w-4 h-4 inline mr-1" />
                  {t('common.copied')}
                {:else}
                  <Copy class="w-4 h-4 inline mr-1" />
                  {t('common.copy')}
                {/if}
              </button>
            </div>
            <textarea
              bind:value={text2}
              placeholder={t('textDiff.newTextPlaceholder')}
              class="textarea font-mono text-sm min-h-[150px]"
            ></textarea>
          </div>
        </div>

        <div class="flex gap-2 mt-4">
          <button
            onclick={clearDiff}
            class="btn-secondary"
          >
            <Trash2 class="w-4 h-4 inline mr-1" />
            {t('common.clear')}
          </button>
        </div>
      </div>

      <!-- 差异对比结果 -->
      {#if text1 || text2}
        <div class="flex-1 min-h-0 flex flex-col">
          <div class="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('textDiff.diff')}
            </h3>
            <div class="flex items-center gap-4 text-xs font-medium">
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 bg-red-500 dark:bg-red-400 rounded"></div>
                <span class="text-red-700 dark:text-red-300">{t('textDiff.deleted')}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 bg-green-500 dark:bg-green-400 rounded"></div>
                <span class="text-green-700 dark:text-green-300">{t('textDiff.inserted')}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 bg-yellow-500 dark:bg-yellow-400 rounded"></div>
                <span class="text-yellow-700 dark:text-yellow-300">{t('textDiff.modified')}</span>
              </div>
            </div>
          </div>
          
          <div class="flex-1 min-h-0 grid grid-cols-2 gap-0 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <!-- 原始文本 -->
            <div class="flex flex-col border-r border-gray-300 dark:border-gray-600 overflow-hidden">
              <div class="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('textDiff.oldText')}
                </span>
              </div>
              <div class="flex-1 overflow-y-auto">
                <div class="font-mono text-sm">
                  {#each diff as line, index}
                    <div class="flex {getLineClass(line.type, 'old')} {getLineBorderClass(line.type)}">
                      <div class="px-2 py-1 text-gray-500 dark:text-gray-400 text-right min-w-[3rem] border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {line.oldLineNumber ?? ''}
                      </div>
                      <div class="flex-1 px-3 py-1 whitespace-pre-wrap break-words">
                        {line.oldLine || '\u00A0'}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- 新文本 -->
            <div class="flex flex-col overflow-hidden">
              <div class="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('textDiff.newText')}
                </span>
              </div>
              <div class="flex-1 overflow-y-auto">
                <div class="font-mono text-sm">
                  {#each diff as line, index}
                    <div class="flex {getLineClass(line.type, 'new')} {getLineBorderClass(line.type)}">
                      <div class="px-2 py-1 text-gray-500 dark:text-gray-400 text-right min-w-[3rem] border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {line.newLineNumber ?? ''}
                      </div>
                      <div class="flex-1 px-3 py-1 whitespace-pre-wrap break-words">
                        {line.newLine || '\u00A0'}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Case Converter -->
  {#if toolType === 'case'}
    <div class="flex-1 flex flex-col space-y-6 min-h-0">
      <!-- 输入区域卡片 -->
      <div class="card flex-shrink-0">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('textCase.input')}
            </label>
            <textarea
              bind:value={caseInput}
              placeholder={t('textCase.inputPlaceholder')}
              class="input font-mono text-sm min-h-32 resize-none"
              rows="5"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('textCase.output')}
            </label>
            <div class="relative">
              <textarea
                value={caseOutput}
                placeholder={t('textCase.outputPlaceholder')}
                readonly
                class="input font-mono text-sm min-h-32 resize-none pr-10"
                rows="5"
              ></textarea>
              <button
                onclick={copyCaseToClipboard}
                class="absolute top-2 right-2 btn-secondary text-sm transition-all duration-200 {caseCopied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
                disabled={!caseOutput}
              >
                {#if caseCopied}
                  <Check class="w-4 h-4 inline mr-1" />
                  {t('textCase.copied')}
                {:else}
                  <Copy class="w-4 h-4 inline mr-1" />
                  {t('textCase.copy')}
                {/if}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('textCase.caseType')}
            </label>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              <button
                onclick={() => caseType = 'uppercase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'uppercase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.uppercase')}
              </button>
              <button
                onclick={() => caseType = 'lowercase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'lowercase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.lowercase')}
              </button>
              <button
                onclick={() => caseType = 'titleCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'titleCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.titleCase')}
              </button>
              <button
                onclick={() => caseType = 'sentenceCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'sentenceCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.sentenceCase')}
              </button>
              <button
                onclick={() => caseType = 'camelCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'camelCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.camelCase')}
              </button>
              <button
                onclick={() => caseType = 'pascalCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'pascalCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.pascalCase')}
              </button>
              <button
                onclick={() => caseType = 'snakeCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'snakeCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.snakeCase')}
              </button>
              <button
                onclick={() => caseType = 'kebabCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'kebabCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.kebabCase')}
              </button>
              <button
                onclick={() => caseType = 'constantCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'constantCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.constantCase')}
              </button>
              <button
                onclick={() => caseType = 'dotCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'dotCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.dotCase')}
              </button>
              <button
                onclick={() => caseType = 'pathCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'pathCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.pathCase')}
              </button>
              <button
                onclick={() => caseType = 'trainCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'trainCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.trainCase')}
              </button>
              <button
                onclick={() => caseType = 'cobolCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'cobolCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.cobolCase')}
              </button>
              <button
                onclick={() => caseType = 'flatCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'flatCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.flatCase')}
              </button>
              <button
                onclick={() => caseType = 'alternatingCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'alternatingCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.alternatingCase')}
              </button>
              <button
                onclick={() => caseType = 'randomCase'}
                class="px-3 py-2 text-sm rounded-lg border transition-colors {caseType === 'randomCase'
                  ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}"
              >
                {t('textCase.randomCase')}
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <button onclick={clearCase} class="btn-secondary">
              <Trash2 class="w-4 h-4 inline mr-1" />
              {t('textCase.clear')}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

