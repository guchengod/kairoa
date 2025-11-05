<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Trash2, FileImage, FileText } from 'lucide-svelte';

  let activeView = $state<'svg' | 'markdown'>('svg');
  let svgContent = $state('');
  let markdownContent = $state('');
  let copied = $state<{ svg: boolean; markdown: boolean; preview: boolean }>({ svg: false, markdown: false, preview: false });
  let previewElement: HTMLDivElement | null = null;

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  async function copyToClipboard(text: string, type: 'svg' | 'markdown' | 'preview') {
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

  async function copyPreviewContent() {
    if (!markdownContent.trim() || !previewElement) return;
    // 从预览 DOM 元素中提取纯文本内容
    const text = previewElement.innerText || previewElement.textContent || '';
    await copyToClipboard(text, 'preview');
  }

  function clear() {
    if (activeView === 'svg') {
      svgContent = '';
    } else {
      markdownContent = '';
    }
    copied = { svg: false, markdown: false, preview: false };
  }

  // 检查 SVG 内容是否有效
  function isValidSVG(content: string): boolean {
    if (!content.trim()) return false;
    try {
      // 简单的 SVG 验证：检查是否包含 SVG 标签
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'image/svg+xml');
      const parseError = doc.querySelector('parsererror');
      return !parseError && doc.querySelector('svg') !== null;
    } catch {
      return false;
    }
  }

  // 渲染 Markdown（简单版本，可以使用 marked 库增强）
  function renderMarkdown(content: string): string {
    if (!content.trim()) return '';
    
    let html = content;
    
    // 先处理代码块（避免代码块内的内容被其他规则处理）
    const codeBlocks: string[] = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      const index = codeBlocks.length;
      codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
      return `__CODE_BLOCK_${index}__`;
    });
    
    // 处理行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理标题（按顺序，从最深层到最浅层）
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // 处理水平线
    html = html.replace(/^---$/gim, '<hr>');
    html = html.replace(/^\*\*\*$/gim, '<hr>');
    
    // 处理粗体（在斜体之前，避免冲突）
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // 处理斜体（避免与粗体重叠）
    html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g, '<em>$1</em>');
    
    // 处理链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // 处理图片
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded">');
    
    // 处理有序列表
    const lines = html.split('\n');
    let inOrderedList = false;
    let orderedListHtml: string[] = [];
    let result: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const orderedMatch = line.match(/^(\d+)\. (.+)$/);
      
      if (orderedMatch) {
        if (!inOrderedList) {
          inOrderedList = true;
          orderedListHtml = [];
        }
        orderedListHtml.push(`<li>${orderedMatch[2]}</li>`);
      } else {
        if (inOrderedList) {
          result.push(`<ol>${orderedListHtml.join('')}</ol>`);
          orderedListHtml = [];
          inOrderedList = false;
        }
        result.push(line);
      }
    }
    
    if (inOrderedList) {
      result.push(`<ol>${orderedListHtml.join('')}</ol>`);
    }
    
    html = result.join('\n');
    
    // 处理无序列表
    html = html.replace(/^(\*|-|\+) (.+)$/gim, '<li>$2</li>');
    
    // 包装连续的无序列表项
    html = html.replace(/(<li>.*<\/li>(?:\s*<li>.*<\/li>)*)/g, '<ul>$1</ul>');
    
    // 处理段落（将连续的非空行包装为段落）
    html = html.split('\n').map(line => {
      if (line.trim() && !line.match(/^<(h[1-6]|ul|ol|li|pre|hr|img)/)) {
        return `<p>${line}</p>`;
      }
      return line;
    }).join('\n');
    
    // 恢复代码块
    codeBlocks.forEach((block, index) => {
      html = html.replace(`__CODE_BLOCK_${index}__`, block);
    });
    
    // 清理多余的换行
    html = html.replace(/\n{3,}/g, '\n\n');
    
    return html;
  }

  function escapeHtml(text: string): string {
    if (typeof document === 'undefined') {
      // 服务端渲染：使用简单的转义
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
</script>

<div class="w-full ml-0 mr-0 p-2 flex flex-col h-[calc(100vh-2rem)]">
  <!-- 标签页导航 -->
  <div class="card p-0 mb-4 flex-shrink-0">
    <div class="flex items-center border-b border-gray-200 dark:border-gray-700">
      <button
        onclick={() => activeView = 'svg'}
        class="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors {activeView === 'svg'
          ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-gray-800'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}"
      >
        <FileImage class="w-4 h-4" />
        <span class="text-sm font-medium">{t('previewer.svg')}</span>
      </button>
      <button
        onclick={() => activeView = 'markdown'}
        class="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors {activeView === 'markdown'
          ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-gray-800'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}"
      >
        <FileText class="w-4 h-4" />
        <span class="text-sm font-medium">{t('previewer.markdown')}</span>
      </button>
    </div>
  </div>

  <!-- 内容区域 -->
  <div class="flex-1 min-h-0 flex flex-col">
    {#if activeView === 'svg'}
      <!-- SVG Preview -->
      <div class="card flex-shrink-0 mb-4">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('previewer.svgInput')}
            </label>
            <button
              onclick={() => copyToClipboard(svgContent, 'svg')}
              class="btn-secondary text-sm transition-all duration-200 {copied.svg ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
            >
              {#if copied.svg}
                <Check class="w-4 h-4 inline mr-1" />
                {t('common.copied')}
              {:else}
                <Copy class="w-4 h-4 inline mr-1" />
                {t('common.copy')}
              {/if}
            </button>
          </div>
          <textarea
            bind:value={svgContent}
            placeholder={t('previewer.svgPlaceholder')}
            class="textarea font-mono text-sm min-h-[150px]"
          ></textarea>
          <div class="flex gap-2">
            <button
              onclick={clear}
              class="btn-secondary"
            >
              <Trash2 class="w-4 h-4 inline mr-1" />
              {t('common.clear')}
            </button>
          </div>
        </div>
      </div>

      <!-- SVG 预览 -->
      {#if svgContent.trim()}
        <div class="card flex-1 min-h-0 flex flex-col">
          <div class="flex items-center justify-between mb-3 flex-shrink-0">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('previewer.preview')}
            </h3>
            {#if !isValidSVG(svgContent)}
              <span class="text-xs text-red-600 dark:text-red-400">
                {t('previewer.invalidSVG')}
              </span>
            {/if}
          </div>
          <div class="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg overflow-auto bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            {#if isValidSVG(svgContent)}
              <div class="max-w-full max-h-full">
                {@html svgContent}
              </div>
            {:else}
              <div class="text-center text-gray-400 dark:text-gray-500">
                <p class="text-sm">{t('previewer.invalidSVGMessage')}</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {:else if activeView === 'markdown'}
      <!-- Markdown Preview - 左右布局 -->
      <div class="flex-1 min-h-0 flex flex-col">
        <div class="flex items-center justify-between mb-2 flex-shrink-0">
          <div class="flex items-center gap-4">
            <button
              onclick={clear}
              class="btn-secondary text-sm"
            >
              <Trash2 class="w-4 h-4 inline mr-1" />
              {t('common.clear')}
            </button>
          </div>
          <button
            onclick={copyPreviewContent}
            class="btn-secondary text-sm transition-all duration-200 {copied.preview ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
            disabled={!markdownContent.trim()}
          >
            {#if copied.preview}
              <Check class="w-4 h-4 inline mr-1" />
              {t('common.copied')}
            {:else}
              <Copy class="w-4 h-4 inline mr-1" />
              {t('common.copy')}
            {/if}
          </button>
        </div>
        
        <div class="flex-1 min-h-0 grid grid-cols-2 gap-4">
          <!-- Markdown 输入 -->
          <div class="card flex flex-col h-full">
            <div class="flex items-center justify-between mb-2 flex-shrink-0">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('previewer.markdownInput')}
              </label>
            </div>
            <div class="flex-1 min-h-0">
              <textarea
                bind:value={markdownContent}
                placeholder={t('previewer.markdownPlaceholder')}
                class="textarea font-mono text-sm h-full resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Markdown 预览 -->
          <div class="card flex flex-col h-full">
            <div class="flex items-center justify-between mb-2 flex-shrink-0">
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('previewer.preview')}
              </h3>
            </div>
            <div class="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg overflow-auto bg-white dark:bg-gray-800 p-6 min-h-0">
              {#if markdownContent.trim()}
                <div class="markdown-content" bind:this={previewElement}>
                  {@html renderMarkdown(markdownContent)}
                </div>
              {:else}
                <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                  {t('previewer.markdownPlaceholder')}
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

