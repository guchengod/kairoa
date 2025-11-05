<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Trash2, FileText } from 'lucide-svelte';

  let text1 = $state('');
  let text2 = $state('');
  let copied = $state<{ old: boolean; new: boolean }>({ old: false, new: false });

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

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

  async function copyToClipboard(text: string, side: 'old' | 'new') {
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

  function clear() {
    text1 = '';
    text2 = '';
    copied = { old: false, new: false };
  }
</script>

<div class="w-full ml-0 mr-0 p-2 flex flex-col h-[calc(100vh-2rem)]">
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
            onclick={() => copyToClipboard(text1, 'old')}
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
            onclick={() => copyToClipboard(text2, 'new')}
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
        onclick={clear}
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

