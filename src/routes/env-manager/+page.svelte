<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { onMount } from 'svelte';
  import { Copy, Check, Plus, Trash2, Download, Upload, X, Edit2, Save } from 'lucide-svelte';

  interface EnvVar {
    key: string;
    value: string;
    id: string;
  }

  let translations = $derived($translationsStore);
  let envVars = $state<EnvVar[]>([]);
  let newKey = $state('');
  let newValue = $state('');
  let editingId = $state<string | null>(null);
  let editKey = $state('');
  let editValue = $state('');
  let copied = $state(false);
  let importText = $state('');
  let showImportDialog = $state(false);
  let searchQuery = $state('');

  const filteredEnvVars = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return envVars;
    return envVars.filter((v) =>
      v.key.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
    );
  });

  const duplicateKeys = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const v of envVars) {
      const k = v.key;
      if (!k) continue;
      counts[k] = (counts[k] || 0) + 1;
    }
    return new Set(Object.keys(counts).filter((k) => counts[k] > 1));
  });

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // 从 localStorage 加载
  function loadFromStorage() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('env-manager-vars');
      if (saved) {
        try {
          envVars = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to load env vars:', e);
        }
      }
    }
  }

  // 保存到 localStorage
  function saveToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('env-manager-vars', JSON.stringify(envVars));
    }
  }

  // 添加环境变量
  function addEnvVar() {
    if (!newKey.trim()) return;
    
    const id = Date.now().toString();
    envVars = [...envVars, { key: newKey.trim(), value: newValue, id }];
    newKey = '';
    newValue = '';
    saveToStorage();
  }

  // 开始编辑
  function startEdit(envVar: EnvVar) {
    editingId = envVar.id;
    editKey = envVar.key;
    editValue = envVar.value;
  }

  // 保存编辑
  function saveEdit() {
    if (!editKey.trim() || !editingId) return;
    
    envVars = envVars.map(v => 
      v.id === editingId 
        ? { ...v, key: editKey.trim(), value: editValue }
        : v
    );
    editingId = null;
    editKey = '';
    editValue = '';
    saveToStorage();
  }

  // 取消编辑
  function cancelEdit() {
    editingId = null;
    editKey = '';
    editValue = '';
  }

  // 删除环境变量
  function deleteEnvVar(id: string) {
    envVars = envVars.filter(v => v.id !== id);
    saveToStorage();
  }

  // 导出为 .env 格式
  function exportToEnv(): string {
    return envVars.map(v => `${v.key}=${v.value}`).join('\n');
  }

  // 复制所有环境变量
  async function copyAll() {
    const envText = exportToEnv();
    if (!envText) return;
    
    try {
      await navigator.clipboard.writeText(envText);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // 下载为 .env 文件
  function downloadEnv() {
    const envText = exportToEnv();
    if (!envText) return;
    
    const blob = new Blob([envText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 导入 .env 格式文本
  function importFromText() {
    if (!importText.trim()) return;
    
    const lines = importText.split('\n');
    const newVars: EnvVar[] = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return; // 跳过空行和注释
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key) {
          newVars.push({
            key,
            value,
            id: `${Date.now()}-${index}`
          });
        }
      }
    });
    
    if (newVars.length > 0) {
      envVars = [...envVars, ...newVars];
      saveToStorage();
      importText = '';
      showImportDialog = false;
    }
  }

  // 清空所有
  function clearAll() {
    if (confirm(t('envManager.confirmClear'))) {
      envVars = [];
      saveToStorage();
    }
  }

  // 处理添加环境变量的键盘事件
  function handleAddKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // 只有 key 和 value 都有值时才触发添加
      if (newKey.trim() && newValue.trim()) {
        addEnvVar();
      }
    }
  }

  onMount(() => {
    loadFromStorage();
  });
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <div class="card flex-1 flex flex-col min-h-0">
    <div class="flex items-center justify-end mb-6 gap-2">
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={t('envManager.searchPlaceholder')}
          class="input text-sm w-64"
        />
        <button
          onclick={() => showImportDialog = true}
          class="btn-secondary text-sm flex items-center gap-1"
          title={t('envManager.import')}
        >
          <Upload class="w-4 h-4" />
          {t('envManager.import')}
        </button>
        <button
          onclick={downloadEnv}
          class="btn-secondary text-sm flex items-center gap-1"
          disabled={envVars.length === 0}
          title={t('envManager.export')}
        >
          <Download class="w-4 h-4" />
          {t('envManager.export')}
        </button>
        <button
          onclick={copyAll}
          class="btn-secondary text-sm flex items-center gap-1"
          disabled={envVars.length === 0}
          title={t('envManager.copyAll')}
        >
          {#if copied}
            <Check class="w-4 h-4" />
            {t('common.copied')}
          {:else}
            <Copy class="w-4 h-4" />
            {t('envManager.copyAll')}
          {/if}
        </button>
        <button
          onclick={clearAll}
          class="btn-secondary text-sm flex items-center gap-1 text-red-600 dark:text-red-400"
          disabled={envVars.length === 0}
          title={t('envManager.clearAll')}
        >
          <Trash2 class="w-4 h-4" />
          {t('envManager.clearAll')}
        </button>
      </div>
    </div>

    <!-- 添加新环境变量 -->
    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
      <div class="flex items-start gap-2">
        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <input
              type="text"
              bind:value={newKey}
              placeholder={t('envManager.keyPlaceholder')}
              class="input text-sm w-full"
              onkeydown={handleAddKeyDown}
              autofocus
            />
          </div>
          <div>
            <input
              type="text"
              bind:value={newValue}
              placeholder={t('envManager.valuePlaceholder')}
              class="input text-sm w-full"
              onkeydown={handleAddKeyDown}
            />
          </div>
        </div>
        <button
          onclick={addEnvVar}
          class="btn-primary text-sm flex items-center justify-center gap-1 whitespace-nowrap"
          disabled={!newKey.trim() || !newValue.trim()}
          title={newKey.trim() && newValue.trim() ? t('envManager.add') : t('envManager.addHint')}
        >
          <Plus class="w-4 h-4" />
          {t('envManager.add')}
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {t('envManager.addHint')}
      </p>
    </div>

    <!-- 环境变量列表 -->
    <div class="flex-1 overflow-y-auto">
      {#if envVars.length === 0}
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {t('envManager.noVars')}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {t('envManager.noVarsDesc')}
          </p>
        </div>
      {:else if filteredEnvVars.length === 0 && searchQuery.trim()}
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {t('envManager.noSearchResults')}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {t('envManager.noSearchResultsDesc')}
          </p>
        </div>
      {:else}
        <div class="space-y-1">
          {#each filteredEnvVars as envVar (envVar.id)}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 hover:border-primary-500 dark:hover:border-primary-500 transition-colors">
              {#if editingId === envVar.id}
                <!-- 编辑模式 -->
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    bind:value={editKey}
                    class="input text-xs py-1 flex-1"
                    onkeydown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === 'Escape') {
                        cancelEdit();
                      }
                    }}
                  />
                  <span class="text-gray-400 dark:text-gray-500 text-xs">=</span>
                  <input
                    type="text"
                    bind:value={editValue}
                    class="input text-xs py-1 flex-1"
                    onkeydown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === 'Escape') {
                        cancelEdit();
                      }
                    }}
                  />
                  <div class="flex gap-1 flex-shrink-0">
                    <button
                      onclick={saveEdit}
                      class="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                      disabled={!editKey.trim()}
                      title={t('common.save')}
                    >
                      <Save class="w-3.5 h-3.5" />
                    </button>
                    <button
                      onclick={cancelEdit}
                      class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                      title={t('common.cancel')}
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              {:else}
                <!-- 显示模式 -->
                <div class="flex items-center gap-2">
                  <div class="flex-1 min-w-0 flex items-center gap-2">
                    <span class="font-mono font-semibold text-xs text-gray-900 dark:text-gray-100">
                      {envVar.key}
                    </span>
                    {#if duplicateKeys.has(envVar.key)}
                      <span class="px-1 py-0.5 rounded-full text-[9px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                        {t('envManager.duplicateKey')}
                      </span>
                    {/if}
                    <span class="text-gray-400 dark:text-gray-500 text-xs">=</span>
                    <span class="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                      {envVar.value || t('envManager.emptyValue')}
                    </span>
                  </div>
                  <div class="flex gap-0.5 flex-shrink-0">
                    <button
                      onclick={() => startEdit(envVar)}
                      class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      onclick={() => {
                        const text = `${envVar.key}=${envVar.value}`;
                        navigator.clipboard.writeText(text);
                      }}
                      class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                      title={t('common.copy')}
                    >
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                    <button
                      onclick={() => deleteEnvVar(envVar.id)}
                      class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- 导入对话框 -->
{#if showImportDialog}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('envManager.import')}
        </h3>
        <button
          onclick={() => {
            showImportDialog = false;
            importText = '';
          }}
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
      <div class="flex-1 p-4 overflow-y-auto">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {t('envManager.importDesc')}
        </p>
        <textarea
          bind:value={importText}
          placeholder={t('envManager.importPlaceholder')}
          class="textarea font-mono text-sm min-h-[200px] w-full"
        ></textarea>
      </div>
      <div class="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onclick={() => {
            showImportDialog = false;
            importText = '';
          }}
          class="btn-secondary"
        >
          {t('common.cancel')}
        </button>
        <button
          onclick={importFromText}
          class="btn-primary"
          disabled={!importText.trim()}
        >
          {t('envManager.import')}
        </button>
      </div>
    </div>
  </div>
{/if}
