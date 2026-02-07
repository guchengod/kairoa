<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { onMount } from 'svelte';
  import { Search, Plus, Edit2, Trash2, Eye, EyeOff, Copy, Check, Lock, Unlock, Download, Upload, X, Save, AlertCircle, Key } from 'lucide-svelte';
  import CryptoJS from 'crypto-js';

  interface PasswordEntry {
    id: string;
    title: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
    category: string;
    createdAt: number;
    updatedAt: number;
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

  const STORAGE_KEY = 'password-vault-encrypted';
  const CATEGORIES = ['general', 'work', 'personal', 'finance', 'social', 'development'];

  let isUnlocked = $state(false);
  let masterPassword = $state('');
  let masterPasswordError = $state('');
  let isFirstTime = $state(false);
  let entries = $state<PasswordEntry[]>([]);
  let searchQuery = $state('');
  let selectedCategory = $state('all');
  let showPassword = $state<Record<string, boolean>>({});
  let editingId = $state<string | null>(null);
  let showNewDialog = $state(false);
  let showResetDialog = $state(false);
  let showDeleteDialog = $state(false);
  let deleteTargetId = $state<string | null>(null);
  let copied = $state('');

  // 新增/编辑表单
  let formTitle = $state('');
  let formUsername = $state('');
  let formPassword = $state('');
  let formUrl = $state('');
  let formNotes = $state('');
  let formCategory = $state('general');

  // 检查是否首次使用
  $effect(() => {
    if (typeof window !== 'undefined') {
      const encrypted = localStorage.getItem(STORAGE_KEY);
      isFirstTime = !encrypted;
    }
  });

  const filteredEntries = $derived.by(() => {
    let result = entries;
    
    if (selectedCategory !== 'all') {
      result = result.filter(e => e.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url?.toLowerCase().includes(q)
      );
    }
    
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  });

  // 加密数据
  function encryptData(data: string, password: string): string {
    return CryptoJS.AES.encrypt(data, password).toString();
  }

  // 解密数据
  function decryptData(encryptedData: string, password: string): string | null {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    } catch {
      return null;
    }
  }

  // 解锁/创建保险库
  function unlock() {
    if (!masterPassword.trim()) {
      masterPasswordError = t('passwordVault.errors.masterPasswordRequired');
      return;
    }

    if (masterPassword.length < 6) {
      masterPasswordError = t('passwordVault.errors.masterPasswordTooShort');
      return;
    }

    const encrypted = localStorage.getItem(STORAGE_KEY);
    
    if (!encrypted) {
      // 首次使用，创建保险库
      isUnlocked = true;
      entries = [];
      masterPasswordError = '';
      saveToStorage(); // 保存空数据以标记已初始化
      return;
    }

    const decrypted = decryptData(encrypted, masterPassword);
    
    if (!decrypted) {
      masterPasswordError = t('passwordVault.errors.wrongMasterPassword');
      return;
    }

    try {
      entries = JSON.parse(decrypted);
      isUnlocked = true;
      masterPasswordError = '';
    } catch {
      masterPasswordError = t('passwordVault.errors.corruptedData');
    }
  }

  // 锁定保险库
  function lock() {
    isUnlocked = false;
    masterPassword = '';
    entries = [];
    showPassword = {};
    editingId = null;
    showNewDialog = false;
    searchQuery = '';
  }

  // 清除所有数据（重置保险库）
  function clearAllData() {
    showResetDialog = true;
  }

  // 确认重置
  function confirmReset() {
    localStorage.removeItem(STORAGE_KEY);
    showResetDialog = false;
    lock();
    isFirstTime = true;
  }

  // 保存到存储
  function saveToStorage() {
    if (!masterPassword) return;
    const data = JSON.stringify(entries);
    const encrypted = encryptData(data, masterPassword);
    localStorage.setItem(STORAGE_KEY, encrypted);
  }

  // 添加/更新条目
  function saveEntry() {
    if (!formTitle.trim() || !formPassword.trim()) return;

    const now = Date.now();
    
    if (editingId) {
      entries = entries.map(e =>
        e.id === editingId
          ? { ...e, title: formTitle, username: formUsername, password: formPassword, url: formUrl, notes: formNotes, category: formCategory, updatedAt: now }
          : e
      );
    } else {
      entries = [...entries, {
        id: crypto.randomUUID(),
        title: formTitle,
        username: formUsername,
        password: formPassword,
        url: formUrl,
        notes: formNotes,
        category: formCategory,
        createdAt: now,
        updatedAt: now
      }];
    }

    saveToStorage();
    closeDialog();
  }

  // 删除条目
  function deleteEntry(id: string) {
    deleteTargetId = id;
    showDeleteDialog = true;
  }

  // 确认删除
  function confirmDelete() {
    if (deleteTargetId) {
      entries = entries.filter(e => e.id !== deleteTargetId);
      saveToStorage();
    }
    showDeleteDialog = false;
    deleteTargetId = null;
  }

  // 开始编辑
  function startEdit(entry: PasswordEntry) {
    editingId = entry.id;
    formTitle = entry.title;
    formUsername = entry.username;
    formPassword = entry.password;
    formUrl = entry.url || '';
    formNotes = entry.notes || '';
    formCategory = entry.category;
    showNewDialog = true;
  }

  // 关闭对话框
  function closeDialog() {
    showNewDialog = false;
    editingId = null;
    formTitle = '';
    formUsername = '';
    formPassword = '';
    formUrl = '';
    formNotes = '';
    formCategory = 'general';
  }

  // 切换密码可见性
  function togglePasswordVisibility(id: string) {
    showPassword[id] = !showPassword[id];
  }

  // 复制到剪贴板
  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = id;
      setTimeout(() => copied = '', 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // 导出数据
  async function exportData() {
    try {
      const data = JSON.stringify(entries, null, 2);
      const encrypted = encryptData(data, masterPassword);
      
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      console.log('Checking Tauri environment:', isTauri);
      
      // 尝试使用 Tauri 的文件保存对话框
      if (isTauri) {
        console.log('Tauri detected, trying to use save dialog...');
        try {
          // @ts-ignore
          const { save } = await import('@tauri-apps/plugin-dialog');
          // @ts-ignore
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');
          
          console.log('Tauri plugins imported successfully');
          
          const filePath = await save({
            defaultPath: `password-vault-${Date.now()}.enc`,
            filters: [{
              name: 'Encrypted File',
              extensions: ['enc']
            }]
          });
          
          console.log('Save dialog result:', filePath);
          
          if (filePath) {
            await writeTextFile(filePath, encrypted);
            console.log('File written successfully');
            copied = 'export-success';
            setTimeout(() => copied = '', 2000);
            return;
          } else {
            // 用户取消了保存
            console.log('User cancelled save dialog');
            return;
          }
        } catch (tauriError) {
          console.error('Tauri save failed:', tauriError);
          alert(t('passwordVault.errors.exportFailed') + '\n\n' + tauriError);
          return;
        }
      }
      
      console.log('Not in Tauri environment, checking for File System Access API');
      
      // 尝试使用浏览器的 File System Access API（Chrome/Edge）
      if ('showSaveFilePicker' in window) {
        try {
          console.log('File System Access API available');
          // @ts-ignore
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: `password-vault-${Date.now()}.enc`,
            types: [{
              description: 'Encrypted File',
              accept: { 'text/plain': ['.enc'] }
            }]
          });
          
          const writable = await fileHandle.createWritable();
          await writable.write(encrypted);
          await writable.close();
          
          console.log('File saved via File System Access API');
          copied = 'export-success';
          setTimeout(() => copied = '', 2000);
          return;
        } catch (fsError) {
          // 用户可能取消了，或者浏览器不支持
          if ((fsError as any).name !== 'AbortError') {
            console.error('File System Access API failed:', fsError);
          } else {
            console.log('User cancelled save dialog');
            return;
          }
        }
      }
      
      console.log('Using fallback browser download');
      
      // 备用方案：使用浏览器直接下载
      const blob = new Blob([encrypted], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `password-vault-${Date.now()}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // 显示成功提示
      copied = 'export-success';
      setTimeout(() => copied = '', 2000);
    } catch (error) {
      console.error('Export failed:', error);
      alert(t('passwordVault.errors.exportFailed') + '\n\n' + error);
    }
  }

  // 导入数据
  function importData(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const encrypted = e.target?.result as string;
      const decrypted = decryptData(encrypted, masterPassword);
      
      if (!decrypted) {
        alert(t('passwordVault.errors.importFailed'));
        return;
      }

      try {
        const imported = JSON.parse(decrypted);
        entries = [...entries, ...imported];
        saveToStorage();
        alert(t('passwordVault.importSuccess'));
      } catch {
        alert(t('passwordVault.errors.invalidFile'));
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  // 生成随机密码
  function generatePassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    formPassword = password;
  }
</script>

{#if !isUnlocked}
  <!-- 解锁界面 -->
  <div class="flex items-center justify-center h-full w-full p-4">
    <div class="card max-w-md w-full">
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
          <Lock class="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('passwordVault.title')}
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {isFirstTime ? t('passwordVault.createDescription') : t('passwordVault.unlockDescription')}
        </p>
      </div>

      <div class="space-y-4">
        <div>
          <label for="master-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('passwordVault.masterPassword')}
          </label>
          <input
            id="master-password"
            type="password"
            bind:value={masterPassword}
            placeholder={isFirstTime ? t('passwordVault.createPasswordPlaceholder') : t('passwordVault.masterPasswordPlaceholder')}
            class="input w-full"
            onkeydown={(e) => e.key === 'Enter' && unlock()}
            autofocus
          />
          {#if masterPasswordError}
            <p class="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle class="w-3 h-3" />
              {masterPasswordError}
            </p>
          {/if}
          {#if isFirstTime && !masterPasswordError}
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('passwordVault.createPasswordHint')}
            </p>
          {/if}
        </div>

        <button
          onclick={unlock}
          class="btn-primary w-full"
          disabled={!masterPassword.trim()}
        >
          <Unlock class="w-4 h-4 inline mr-2" />
          {isFirstTime ? t('passwordVault.create') : t('passwordVault.unlock')}
        </button>

        {#if isFirstTime}
          <!-- 首次创建的重要提示 -->
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 rounded">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                  {t('passwordVault.importantReminder')}
                </h3>
                <ul class="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• {t('passwordVault.reminder1')}</li>
                  <li>• {t('passwordVault.reminder2')}</li>
                  <li>• {t('passwordVault.reminder3')}</li>
                </ul>
              </div>
            </div>
          </div>
        {/if}

        <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('passwordVault.securityNote')}
          </p>
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- 主界面 -->
  <div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
    <div class="card flex-1 flex flex-col min-h-0">
      <!-- 顶部工具栏 -->
      <div class="flex items-center justify-between mb-4 gap-2">
        <div class="flex items-center gap-2 flex-1">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={t('passwordVault.searchPlaceholder')}
            class="input text-sm w-64"
          />
          <select bind:value={selectedCategory} class="input text-sm">
            <option value="all">{t('passwordVault.allCategories')}</option>
            {#each CATEGORIES as cat}
              <option value={cat}>{t(`passwordVault.categories.${cat}`)}</option>
            {/each}
          </select>
        </div>

        <div class="flex gap-2">
          <button onclick={() => showNewDialog = true} class="btn-primary text-sm">
            <Plus class="w-4 h-4 inline mr-1" />
            {t('passwordVault.addNew')}
          </button>
          <label class="btn-secondary text-sm cursor-pointer">
            <Upload class="w-4 h-4 inline mr-1" />
            {t('passwordVault.import')}
            <input type="file" accept=".enc" class="hidden" onchange={importData} />
          </label>
          <button onclick={exportData} class="btn-secondary text-sm" disabled={entries.length === 0}>
            {#if copied === 'export-success'}
              <Check class="w-4 h-4 inline mr-1" />
              {t('passwordVault.exported')}
            {:else}
              <Download class="w-4 h-4 inline mr-1" />
              {t('passwordVault.export')}
            {/if}
          </button>
          <button onclick={clearAllData} class="btn-secondary text-sm text-orange-600 dark:text-orange-400" title={t('passwordVault.resetHint')}>
            <AlertCircle class="w-4 h-4 inline mr-1" />
            {t('passwordVault.reset')}
          </button>
          <button onclick={lock} class="btn-secondary text-sm text-red-600 dark:text-red-400">
            <Lock class="w-4 h-4 inline mr-1" />
            {t('passwordVault.lock')}
          </button>
        </div>
      </div>

      <!-- 条目列表 -->
      <div class="flex-1 overflow-y-auto">
        {#if filteredEntries.length === 0}
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <Key class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {searchQuery || selectedCategory !== 'all' ? t('passwordVault.noResults') : t('passwordVault.noEntries')}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {searchQuery || selectedCategory !== 'all' ? t('passwordVault.noResultsDesc') : t('passwordVault.noEntriesDesc')}
            </p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each filteredEntries as entry (entry.id)}
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-500 dark:hover:border-primary-500 transition-colors">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                      <h3 class="font-semibold text-gray-900 dark:text-gray-100">{entry.title}</h3>
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {t(`passwordVault.categories.${entry.category}`)}
                      </span>
                    </div>
                    
                    <div class="space-y-1 text-sm">
                      {#if entry.username}
                        <div class="flex items-center gap-2">
                          <span class="text-gray-500 dark:text-gray-400 w-20">{t('passwordVault.username')}:</span>
                          <span class="font-mono text-gray-900 dark:text-gray-100">{entry.username}</span>
                        </div>
                      {/if}
                      
                      <div class="flex items-center gap-2">
                        <span class="text-gray-500 dark:text-gray-400 w-20">{t('passwordVault.password')}:</span>
                        <span class="font-mono text-gray-900 dark:text-gray-100">
                          {showPassword[entry.id] ? entry.password : '••••••••'}
                        </span>
                        <button
                          onclick={() => togglePasswordVisibility(entry.id)}
                          class="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title={showPassword[entry.id] ? t('common.hide') : t('common.show')}
                        >
                          {#if showPassword[entry.id]}
                            <EyeOff class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                          {:else}
                            <Eye class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                          {/if}
                        </button>
                        <button
                          onclick={() => copyToClipboard(entry.password, `pwd-${entry.id}`)}
                          class="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title={t('common.copy')}
                        >
                          {#if copied === `pwd-${entry.id}`}
                            <Check class="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          {:else}
                            <Copy class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                          {/if}
                        </button>
                      </div>
                      
                      {#if entry.url}
                        <div class="flex items-center gap-2">
                          <span class="text-gray-500 dark:text-gray-400 w-20">{t('passwordVault.url')}:</span>
                          <a href={entry.url} target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline truncate">
                            {entry.url}
                          </a>
                        </div>
                      {/if}
                      
                      {#if entry.notes}
                        <div class="flex gap-2 mt-2">
                          <span class="text-gray-500 dark:text-gray-400 w-20">{t('passwordVault.notes')}:</span>
                          <span class="text-gray-700 dark:text-gray-300 text-xs">{entry.notes}</span>
                        </div>
                      {/if}
                    </div>
                  </div>

                  <div class="flex gap-1 flex-shrink-0">
                    <button
                      onclick={() => startEdit(entry)}
                      class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      title={t('common.edit')}
                    >
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button
                      onclick={() => deleteEntry(entry.id)}
                      class="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      title={t('common.delete')}
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- 新增/编辑对话框 -->
  {#if showNewDialog}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {editingId ? t('passwordVault.editEntry') : t('passwordVault.addNew')}
          </h3>
          <button onclick={closeDialog} class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div class="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <label for="form-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('passwordVault.title')} *
            </label>
            <input
              id="form-title"
              type="text"
              bind:value={formTitle}
              placeholder={t('passwordVault.titlePlaceholder')}
              class="input w-full"
            />
          </div>

          <div>
            <label for="form-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('passwordVault.category')}
            </label>
            <select id="form-category" bind:value={formCategory} class="input w-full">
              {#each CATEGORIES as cat}
                <option value={cat}>{t(`passwordVault.categories.${cat}`)}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="form-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('passwordVault.username')}
            </label>
            <input
              id="form-username"
              type="text"
              bind:value={formUsername}
              placeholder={t('passwordVault.usernamePlaceholder')}
              class="input w-full"
            />
          </div>

          <div>
            <label for="form-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('passwordVault.password')} *
            </label>
            <div class="flex gap-2">
              <input
                id="form-password"
                type="text"
                bind:value={formPassword}
                placeholder={t('passwordVault.passwordPlaceholder')}
                class="input flex-1"
              />
              <button
                onclick={generatePassword}
                class="btn-secondary text-sm whitespace-nowrap"
                title={t('passwordVault.generate')}
              >
                {t('passwordVault.generate')}
              </button>
            </div>
          </div>

          <div>
            <label for="form-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('passwordVault.url')}
            </label>
            <input
              id="form-url"
              type="url"
              bind:value={formUrl}
              placeholder={t('passwordVault.urlPlaceholder')}
              class="input w-full"
            />
          </div>

          <div>
            <label for="form-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('passwordVault.notes')}
            </label>
            <textarea
              id="form-notes"
              bind:value={formNotes}
              placeholder={t('passwordVault.notesPlaceholder')}
              class="textarea w-full"
              rows="3"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onclick={closeDialog} class="btn-secondary">
            {t('common.cancel')}
          </button>
          <button
            onclick={saveEntry}
            class="btn-primary"
            disabled={!formTitle.trim() || !formPassword.trim()}
          >
            <Save class="w-4 h-4 inline mr-1" />
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- 重置确认对话框 -->
  {#if showResetDialog}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div class="p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <AlertCircle class="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('passwordVault.resetTitle')}
            </h3>
          </div>

          <div class="space-y-3 mb-6">
            <p class="text-sm text-gray-700 dark:text-gray-300">
              {t('passwordVault.resetWarning1')}
            </p>
            <ul class="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>{t('passwordVault.resetWarning2')}</li>
              <li>{t('passwordVault.resetWarning3')}</li>
              <li>{t('passwordVault.resetWarning4')}</li>
            </ul>
            <p class="text-sm font-semibold text-red-600 dark:text-red-400">
              {t('passwordVault.resetWarning5')}
            </p>
          </div>

          <div class="flex gap-2">
            <button
              onclick={() => showResetDialog = false}
              class="btn-secondary flex-1"
            >
              {t('common.cancel')}
            </button>
            <button
              onclick={confirmReset}
              class="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
            >
              {t('passwordVault.confirmResetButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- 删除确认对话框 -->
  {#if showDeleteDialog}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div class="p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle class="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('passwordVault.deleteTitle')}
            </h3>
          </div>

          <p class="text-sm text-gray-700 dark:text-gray-300 mb-6">
            {t('passwordVault.deleteConfirm')}
          </p>

          <div class="flex gap-2">
            <button
              onclick={() => { showDeleteDialog = false; deleteTargetId = null; }}
              class="btn-secondary flex-1"
            >
              {t('common.cancel')}
            </button>
            <button
              onclick={confirmDelete}
              class="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
            >
              {t('passwordVault.deleteButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}
