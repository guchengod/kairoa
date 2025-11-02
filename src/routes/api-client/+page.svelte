<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Send, Trash2, Plus, X } from 'lucide-svelte';
  import { browser } from '$app/environment';
  
  // 动态导入 Tauri API（仅在浏览器环境中可用）
  let invokeFn: ((cmd: string, args?: any) => Promise<any>) | null = $state(null);
  let isTauriAvailable = $state(false);
  
  if (browser) {
    // 检查是否在 Tauri 环境中
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      isTauriAvailable = true;
      // 异步加载 Tauri API
      import('@tauri-apps/api/core')
        .then((module) => {
          invokeFn = module.invoke;
        })
        .catch((err) => {
          console.error('Failed to load Tauri API:', err);
          isTauriAvailable = false;
        });
    }
  }
  
  type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  type BodyType = 'json' | 'text' | 'xml' | 'form-data' | 'url-encoded' | 'none';
  
  interface Header {
    key: string;
    value: string;
    enabled: boolean;
  }
  
  interface FormDataItem {
    key: string;
    value: string;
    enabled: boolean;
    type: 'text' | 'file';
    file: File | null;
  }

  interface TabData {
    id: string;
    name: string;
    method: HttpMethod;
    url: string;
    headers: Header[];
    bodyType: BodyType;
    bodyJson: string;
    bodyText: string;
    bodyXml: string;
    formData: FormDataItem[];
    isSending: boolean;
    responseStatus: number | null;
    responseHeaders: Record<string, string>;
    responseBody: string;
    responseTime: number | null;
    error: string;
    copied: boolean;
  }
  
  let tabs = $state<TabData[]>([
    {
      id: crypto.randomUUID(),
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: [{ key: '', value: '', enabled: true }],
      bodyType: 'none',
      bodyJson: '',
      bodyText: '',
      bodyXml: '',
      formData: [{ key: '', value: '', enabled: true, type: 'text', file: null }],
      isSending: false,
      responseStatus: null,
      responseHeaders: {},
      responseBody: '',
      responseTime: null,
      error: '',
      copied: false
    }
  ]);
  
  let activeTabId = $state('');

  // 初始化 activeTabId
  $effect(() => {
    if (!activeTabId && tabs.length > 0) {
      activeTabId = tabs[0].id;
    }
  });

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // 获取当前激活的标签页
  let activeTab = $derived(tabs.find(tab => tab.id === activeTabId) || tabs[0]);

  // 添加新标签页
  function addTab() {
    const newTab: TabData = {
      id: crypto.randomUUID(),
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: [{ key: '', value: '', enabled: true }],
      bodyType: 'none',
      bodyJson: '',
      bodyText: '',
      bodyXml: '',
      formData: [{ key: '', value: '', enabled: true, type: 'text', file: null }],
      isSending: false,
      responseStatus: null,
      responseHeaders: {},
      responseBody: '',
      responseTime: null,
      error: '',
      copied: false
    };
    tabs = [...tabs, newTab];
    activeTabId = newTab.id;
  }

  // 删除标签页
  function removeTab(tabId: string) {
    if (tabs.length === 1) return; // 至少保留一个标签页
    
    tabs = tabs.filter(tab => tab.id !== tabId);
    
    // 如果删除的是当前激活的标签页，切换到第一个标签页
    if (activeTabId === tabId) {
      activeTabId = tabs[0].id;
    }
  }

  // 切换标签页
  function setActiveTab(tabId: string) {
    activeTabId = tabId;
  }

  // 更新标签页名称（基于 URL）
  function updateTabName(tab: TabData) {
    if (tab.url.trim()) {
      try {
        const url = new URL(tab.url);
        tab.name = url.pathname || url.hostname || 'New Request';
      } catch {
        tab.name = tab.url.substring(0, 20) || 'New Request';
      }
    } else {
      tab.name = 'New Request';
    }
  }

  function addHeader(tab: TabData) {
    tab.headers = [...tab.headers, { key: '', value: '', enabled: true }];
  }

  function removeHeader(tab: TabData, index: number) {
    tab.headers = tab.headers.filter((_, i) => i !== index);
    if (tab.headers.length === 0) {
      tab.headers = [{ key: '', value: '', enabled: true }];
    }
  }

  let showBulkHeaderDialog = $state(false);
  let bulkHeaderText = $state('');

  function parseBulkHeaders(text: string): Header[] {
    const headers: Header[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // 支持 key: value 或 key=value 格式
      let key = '';
      let value = '';
      
      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        key = trimmed.substring(0, colonIndex).trim();
        value = trimmed.substring(colonIndex + 1).trim();
      } else if (trimmed.includes('=')) {
        const equalIndex = trimmed.indexOf('=');
        key = trimmed.substring(0, equalIndex).trim();
        value = trimmed.substring(equalIndex + 1).trim();
      } else {
        continue; // 跳过无法解析的行
      }
      
      if (key && value) {
        headers.push({ key, value, enabled: true });
      }
    }
    
    return headers;
  }

  function addBulkHeaders(tab: TabData) {
    const parsedHeaders = parseBulkHeaders(bulkHeaderText);
    if (parsedHeaders.length > 0) {
      // 移除空的 header（如果存在）
      const existingHeaders = tab.headers.filter(h => h.key.trim() || h.value.trim());
      tab.headers = [...existingHeaders, ...parsedHeaders];
      bulkHeaderText = '';
      showBulkHeaderDialog = false;
    }
  }

  function addFormDataItem(tab: TabData) {
    tab.formData = [...tab.formData, { key: '', value: '', enabled: true, type: 'text', file: null }];
  }

  function removeFormDataItem(tab: TabData, index: number) {
    // 清理文件引用（如果存在）
    if (tab.formData[index].file) {
      tab.formData[index].file = null;
    }
    tab.formData = tab.formData.filter((_, i) => i !== index);
    if (tab.formData.length === 0) {
      tab.formData = [{ key: '', value: '', enabled: true, type: 'text', file: null }];
    }
  }

  function handleFileSelect(tab: TabData, index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      // 文件大小限制（50MB）
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        tab.error = `File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 50MB.`;
        // 重置文件输入
        input.value = '';
        return;
      }
      
      // 清理旧的文件引用
      if (tab.formData[index].file) {
        // 旧文件会被垃圾回收
        tab.formData[index].file = null;
      }
      
      tab.formData[index].file = file;
      tab.formData[index].value = file.name;
      tab.error = ''; // 清除之前的错误
    }
  }

  async function sendRequest(tab: TabData) {
    if (!tab.url.trim()) {
      tab.error = t('apiClient.urlRequired');
      return;
    }

    tab.isSending = true;
    tab.error = '';
    tab.responseStatus = null;
    tab.responseHeaders = {};
    tab.responseBody = '';
    tab.responseTime = null;

    const startTime = Date.now();

    try {
      // 构建请求头
      const requestHeaders: Record<string, string> = {};
      tab.headers.forEach((header) => {
        if (header.enabled && header.key.trim() && header.value.trim()) {
          requestHeaders[header.key.trim()] = header.value.trim();
        }
      });

      // 构建请求体
      let requestBody: string | undefined = undefined;
      
      if (tab.bodyType === 'json' && tab.bodyJson.trim()) {
        try {
          JSON.parse(tab.bodyJson); // 验证 JSON
          requestBody = tab.bodyJson;
          requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
        } catch (e) {
          tab.error = t('apiClient.invalidJson');
          tab.isSending = false;
          return;
        }
      } else if (tab.bodyType === 'text' && tab.bodyText.trim()) {
        requestBody = tab.bodyText;
        requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'text/plain';
      } else if (tab.bodyType === 'xml' && tab.bodyXml.trim()) {
        requestBody = tab.bodyXml;
        requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/xml';
      } else if (tab.bodyType === 'form-data') {
        // 检查是否有文件需要上传
        const hasFiles = tab.formData.some(item => item.enabled && item.type === 'file' && item.file);
        
        // 检查是否在 Tauri 环境中
        const isInTauri = browser && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        
        if (hasFiles) {
          // 如果有文件
          if (!isInTauri) {
            // 浏览器环境：使用 FormData API
            const formData = new FormData();
            
            tab.formData.forEach((item) => {
              if (item.enabled && item.key.trim()) {
                if (item.type === 'file' && item.file) {
                  formData.append(item.key.trim(), item.file);
                } else if (item.type === 'text' && item.value.trim()) {
                  formData.append(item.key.trim(), item.value.trim());
                }
              }
            });
            
            requestBody = formData as any;
            // 不要设置 Content-Type，让浏览器自动设置（包含 boundary）
            delete requestHeaders['Content-Type'];
          } else {
            // Tauri 环境：将 FormData 转换为 base64 格式
            const formDataEntries: Array<{ key: string; value: string; type: 'text' | 'file'; filename?: string }> = [];
            
            for (const item of tab.formData) {
              if (item.enabled && item.key.trim()) {
                if (item.type === 'file' && item.file) {
                  // 读取文件为 base64
                  const arrayBuffer = await item.file.arrayBuffer();
                  const uint8Array = new Uint8Array(arrayBuffer);
                  // 使用块处理避免堆栈溢出
                  let binaryString = '';
                  const chunkSize = 8192; // 8KB chunks
                  for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.slice(i, i + chunkSize);
                    // 逐个处理字符以避免堆栈溢出
                    for (let j = 0; j < chunk.length; j++) {
                      binaryString += String.fromCharCode(chunk[j]);
                    }
                  }
                  const base64 = btoa(binaryString);
                  formDataEntries.push({
                    key: item.key.trim(),
                    value: base64,
                    type: 'file',
                    filename: item.file.name
                  });
                } else if (item.type === 'text' && item.value.trim()) {
                  formDataEntries.push({
                    key: item.key.trim(),
                    value: item.value.trim(),
                    type: 'text'
                  });
                }
              }
            }
            
            // 将 formDataEntries 序列化为 JSON，传递给 Rust 后端
            requestBody = JSON.stringify({ type: 'multipart', entries: formDataEntries });
            requestHeaders['Content-Type'] = 'application/json'; // 临时设置，Rust 后端会处理
          }
        } else {
          // 没有文件，使用文本格式的 multipart/form-data
          const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
          const parts: string[] = [];
          
          tab.formData.forEach((item) => {
            if (item.enabled && item.key.trim() && item.type === 'text' && item.value.trim()) {
              parts.push(`--${boundary}`);
              parts.push(`Content-Disposition: form-data; name="${item.key.trim()}"`);
              parts.push('');
              parts.push(item.value.trim());
            }
          });
          parts.push(`--${boundary}--`);
          
          requestBody = parts.join('\r\n');
          requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || `multipart/form-data; boundary=${boundary}`;
        }
      } else if (tab.bodyType === 'url-encoded') {
        // FormData 转换为 application/x-www-form-urlencoded 格式
        const formDataPairs: string[] = [];
        tab.formData.forEach((item) => {
          if (item.enabled && item.key.trim() && item.value.trim()) {
            formDataPairs.push(`${encodeURIComponent(item.key.trim())}=${encodeURIComponent(item.value.trim())}`);
          }
        });
        requestBody = formDataPairs.join('&');
        requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/x-www-form-urlencoded';
      }

      // 检查是否在 Tauri 环境中，如果是则优先使用 Tauri API（绕过 CORS）
      const isInTauri = browser && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      
      // 如果在 Tauri 环境中但 API 还没加载，等待一下
      if (isInTauri && !invokeFn) {
        // 等待最多 1 秒让 Tauri API 加载完成
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (invokeFn) break;
        }
      }

      // 如果可以使用 Tauri API，使用它（绕过 CORS）
      if (isInTauri && invokeFn) {
        // 如果 requestBody 是 FormData（浏览器环境），需要转换为字符串
        let bodyForRequest: string | undefined;
        if (requestBody && typeof requestBody === 'object' && 'append' in requestBody) {
          // 这种情况不应该在 Tauri 环境中发生，因为我们已经转换了
          // 但为了安全起见，我们仍然处理它
          bodyForRequest = undefined;
        } else {
          bodyForRequest = typeof requestBody === 'string' ? requestBody : undefined;
        }
        
        // 使用 Tauri 命令发送请求（绕过 CORS）
        const response = await invokeFn('http_request', {
          request: {
            url: tab.url,
            method: tab.method,
            headers: requestHeaders,
            body: bodyForRequest
          }
        }) as {
          status: number;
          headers: Record<string, string>;
          body: string;
          error: string | null;
        };

        const endTime = Date.now();
        tab.responseTime = endTime - startTime;

        if (response.error) {
          tab.error = response.error;
          tab.responseStatus = null;
        } else {
          tab.responseStatus = response.status;
          tab.responseHeaders = response.headers;
          
          // 尝试格式化 JSON 响应
          if (response.body.trim()) {
            try {
              const json = JSON.parse(response.body);
              tab.responseBody = JSON.stringify(json, null, 2);
            } catch {
              tab.responseBody = response.body;
            }
          } else {
            tab.responseBody = response.body;
          }

          // 更新标签页名称
          updateTabName(tab);
        }
      } else {
        // 回退到使用 fetch（可能在浏览器中运行或 Tauri API 不可用）
        const requestOptions: RequestInit = {
          method: tab.method,
          headers: requestHeaders,
        };

        if (requestBody !== undefined) {
          // 如果是 FormData，不要设置 Content-Type，让浏览器自动设置
          if (requestBody && typeof requestBody === 'object' && 'append' in requestBody) {
            // 删除 Content-Type，让浏览器自动设置 multipart/form-data boundary
            delete (requestOptions.headers as Record<string, string>)['Content-Type'];
          }
          requestOptions.body = requestBody as any;
        }

        const response = await fetch(tab.url, requestOptions);
        const endTime = Date.now();
        tab.responseTime = endTime - startTime;

        // 获取响应状态
        tab.responseStatus = response.status;

        // 获取响应头
        response.headers.forEach((value, key) => {
          tab.responseHeaders[key] = value;
        });

        // 获取响应体
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            const json = await response.json();
            tab.responseBody = JSON.stringify(json, null, 2);
          } catch (e) {
            tab.responseBody = await response.text();
          }
        } else {
          tab.responseBody = await response.text();
        }

        // 更新标签页名称
        updateTabName(tab);
      }
    } catch (err) {
      tab.error = err instanceof Error ? err.message : t('apiClient.requestFailed');
      tab.responseTime = Date.now() - startTime;
    } finally {
      tab.isSending = false;
    }
  }

  async function copyResponse(tab: TabData) {
    const text = tab.responseBody || JSON.stringify({ status: tab.responseStatus, headers: tab.responseHeaders, body: tab.responseBody }, null, 2);
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      tab.copied = true;
      setTimeout(() => {
        tab.copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clear(tab: TabData) {
    tab.url = '';
    tab.headers = [{ key: '', value: '', enabled: true }];
    tab.bodyType = 'none';
    tab.bodyJson = '';
    tab.bodyText = '';
    tab.bodyXml = '';
    tab.formData = [{ key: '', value: '', enabled: true, type: 'text', file: null }];
    tab.responseStatus = null;
    tab.responseHeaders = {};
    tab.responseBody = '';
    tab.responseTime = null;
    tab.error = '';
    tab.name = 'New Request';
  }

  function getStatusColor(status: number | null): string {
    if (!status) return '';
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
    if (status >= 300 && status < 400) return 'text-blue-600 dark:text-blue-400';
    if (status >= 400 && status < 500) return 'text-yellow-600 dark:text-yellow-400';
    if (status >= 500) return 'text-red-600 dark:text-red-400';
    return '';
  }

  // 监听方法变化，自动调整 body 类型
  $effect(() => {
    const currentTab = tabs.find(tab => tab.id === activeTabId);
    if (!currentTab) return;
    
    const method = currentTab.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      if (currentTab.bodyType !== 'none') {
        currentTab.bodyType = 'none';
      }
      // 清理 formData 中的文件引用
      const hasFiles = currentTab.formData.some(item => item.file);
      if (hasFiles) {
        currentTab.formData.forEach(item => {
          if (item.file) {
            item.file = null;
          }
        });
      }
    }
  });

  // 监听 bodyType 变化，清理不相关的数据
  $effect(() => {
    const currentTab = tabs.find(tab => tab.id === activeTabId);
    if (!currentTab) return;
    
    const bodyType = currentTab.bodyType;
    if (bodyType === 'none') {
      if (currentTab.bodyJson) currentTab.bodyJson = '';
      if (currentTab.bodyText) currentTab.bodyText = '';
      if (currentTab.bodyXml) currentTab.bodyXml = '';
      // 清理 formData 中的文件引用
      const hasFiles = currentTab.formData.some(item => item.file);
      if (hasFiles) {
        currentTab.formData.forEach(item => {
          if (item.file) {
            item.file = null;
          }
        });
      }
      // 只在需要时重置 formData
      if (currentTab.formData.length !== 1 || currentTab.formData[0].key !== '' || currentTab.formData[0].value !== '' || currentTab.formData[0].type !== 'text') {
        currentTab.formData = [{ key: '', value: '', enabled: true, type: 'text', file: null }];
      }
    } else if (bodyType !== 'form-data' && bodyType !== 'url-encoded') {
      // 当切换到非 form-data 类型时，清理 formData 中的文件引用
      const hasFiles = currentTab.formData.some(item => item.file);
      if (hasFiles) {
        currentTab.formData.forEach(item => {
          if (item.file) {
            item.file = null;
          }
        });
      }
    }
  });

  // 监听 URL 变化，更新标签页名称
  $effect(() => {
    if (activeTab.url) {
      updateTabName(activeTab);
    }
  });
</script>

<div class="w-full ml-0 mr-0 p-2 space-y-6">
  <!-- 标签页导航 -->
  <div class="card p-0">
    <div class="flex items-center border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      {#each tabs as tab}
        <div class="flex items-center">
          <button
            onclick={() => setActiveTab(tab.id)}
            class="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap {activeTabId === tab.id
              ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-gray-800'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}"
          >
            <span class="text-sm font-medium">{tab.name}</span>
          </button>
          {#if tabs.length > 1}
            <button
              onclick={() => removeTab(tab.id)}
              class="px-2 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <X class="w-3 h-3" />
            </button>
          {/if}
        </div>
      {/each}
      <button
        onclick={addTab}
        class="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>
  </div>

  <!-- 请求配置卡片 -->
  <div class="card">
    <div class="space-y-4">
      <!-- 方法和 URL -->
      <div class="flex gap-2 items-start">
        <select
          bind:value={activeTab.method}
          class="input w-32"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        <input
          type="text"
          bind:value={activeTab.url}
          placeholder={t('apiClient.urlPlaceholder')}
          class="input flex-1"
        />
        <button
          onclick={() => sendRequest(activeTab)}
          disabled={activeTab.isSending || !activeTab.url.trim()}
          class="px-4 py-2 text-white rounded-lg transition-colors font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          style="background-color: #818089;"
        >
          <Send class="w-4 h-4" />
          {#if activeTab.isSending}
            {t('apiClient.sending')}
          {:else}
            {t('apiClient.send')}
          {/if}
        </button>
        <button
          onclick={() => clear(activeTab)}
          disabled={activeTab.isSending}
          class="btn-secondary"
        >
          {t('apiClient.clear')}
        </button>
      </div>

      <!-- Headers -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('apiClient.headers')}
          </div>
          <button
            onclick={() => { bulkHeaderText = ''; showBulkHeaderDialog = true; }}
            class="btn-secondary text-sm"
          >
            {t('apiClient.bulkAdd')}
          </button>
        </div>
        <div class="space-y-2">
          {#each activeTab.headers as header, index}
            <div class="flex gap-2 items-center">
              <input
                type="checkbox"
                bind:checked={header.enabled}
                class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <input
                type="text"
                bind:value={header.key}
                placeholder={t('apiClient.headerKey')}
                class="input flex-1"
                disabled={!header.enabled}
              />
              <input
                type="text"
                bind:value={header.value}
                placeholder={t('apiClient.headerValue')}
                class="input flex-1"
                disabled={!header.enabled}
              />
              <button
                onclick={() => removeHeader(activeTab, index)}
                class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                disabled={activeTab.headers.length === 1}
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          {/each}
          <button
            onclick={() => addHeader(activeTab)}
            class="btn-secondary text-sm"
          >
            {t('apiClient.addHeader')}
          </button>
        </div>
      </div>

      <!-- 批量添加 Header 对话框 -->
      {#if showBulkHeaderDialog}
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onclick={() => { showBulkHeaderDialog = false; bulkHeaderText = ''; }}
          onkeydown={(e) => { if (e.key === 'Escape') { showBulkHeaderDialog = false; bulkHeaderText = ''; } }}
          role="dialog"
          aria-modal="true"
          tabindex="-1"
        >
          <div 
            class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4"
            onclick={(e) => e.stopPropagation()}
            role="none"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('apiClient.bulkAddHeaders')}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('apiClient.bulkAddHeadersHint')}
            </p>
            <textarea
              bind:value={bulkHeaderText}
              placeholder={t('apiClient.bulkAddHeadersPlaceholder')}
              class="textarea font-mono text-sm min-h-[200px] mb-4"
            ></textarea>
            <div class="flex gap-2 justify-end">
              <button
                onclick={() => { showBulkHeaderDialog = false; bulkHeaderText = ''; }}
                class="btn-secondary"
              >
                {t('apiClient.cancel')}
              </button>
              <button
                onclick={() => addBulkHeaders(activeTab)}
                class="px-4 py-2 text-white rounded-lg transition-colors font-medium hover:opacity-90"
                style="background-color: #818089;"
              >
                {t('apiClient.add')}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Body -->
      {#if activeTab.method !== 'GET' && activeTab.method !== 'HEAD' && activeTab.method !== 'OPTIONS'}
        <div>
          <div class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('apiClient.body')}
          </div>
          <div class="flex gap-2 mb-2">
            <button
              onclick={() => activeTab.bodyType = 'none'}
              class="px-3 py-1 text-sm rounded transition-colors {activeTab.bodyType === 'none' ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            >
              None
            </button>
            <button
              onclick={() => activeTab.bodyType = 'json'}
              class="px-3 py-1 text-sm rounded transition-colors {activeTab.bodyType === 'json' ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            >
              JSON
            </button>
            <button
              onclick={() => activeTab.bodyType = 'text'}
              class="px-3 py-1 text-sm rounded transition-colors {activeTab.bodyType === 'text' ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            >
              Text
            </button>
            <button
              onclick={() => activeTab.bodyType = 'xml'}
              class="px-3 py-1 text-sm rounded transition-colors {activeTab.bodyType === 'xml' ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            >
              XML
            </button>
            <button
              onclick={() => activeTab.bodyType = 'form-data'}
              class="px-3 py-1 text-sm rounded transition-colors {activeTab.bodyType === 'form-data' ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            >
              Form Data
            </button>
            <button
              onclick={() => activeTab.bodyType = 'url-encoded'}
              class="px-3 py-1 text-sm rounded transition-colors {activeTab.bodyType === 'url-encoded' ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            >
              URL Encoded
            </button>
          </div>

          {#if activeTab.bodyType === 'json'}
            <textarea
              bind:value={activeTab.bodyJson}
              placeholder={t('apiClient.jsonPlaceholder')}
              class="textarea font-mono text-sm min-h-[150px]"
            ></textarea>
          {:else if activeTab.bodyType === 'text'}
            <textarea
              bind:value={activeTab.bodyText}
              placeholder={t('apiClient.textPlaceholder')}
              class="textarea font-mono text-sm min-h-[150px]"
            ></textarea>
          {:else if activeTab.bodyType === 'xml'}
            <textarea
              bind:value={activeTab.bodyXml}
              placeholder={t('apiClient.xmlPlaceholder')}
              class="textarea font-mono text-sm min-h-[150px]"
            ></textarea>
          {:else if activeTab.bodyType === 'form-data' || activeTab.bodyType === 'url-encoded'}
            <div class="space-y-2">
              {#each activeTab.formData as item, index}
                <div class="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    bind:checked={item.enabled}
                    class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    bind:value={item.key}
                    placeholder={t('apiClient.formKey')}
                    class="input flex-1"
                    disabled={!item.enabled}
                  />
                  {#if activeTab.bodyType === 'form-data'}
                    <select
                      bind:value={item.type}
                      class="input w-24"
                      disabled={!item.enabled}
                      onchange={() => {
                        if (item.type === 'text') {
                          item.file = null;
                          item.value = '';
                        } else {
                          item.value = '';
                        }
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="file">File</option>
                    </select>
                  {/if}
                  {#if item.type === 'text' || activeTab.bodyType === 'url-encoded'}
                    <input
                      type="text"
                      bind:value={item.value}
                      placeholder={t('apiClient.formValue')}
                      class="input flex-1"
                      disabled={!item.enabled}
                    />
                  {:else if item.type === 'file'}
                    <label class="input flex-1 cursor-pointer flex items-center gap-2 {!item.enabled ? 'opacity-50 cursor-not-allowed' : ''}">
                      <input
                        type="file"
                        class="hidden"
                        disabled={!item.enabled}
                        onchange={(e) => handleFileSelect(activeTab, index, e)}
                      />
                      <span class="flex-1 text-gray-700 dark:text-gray-300">
                        {item.value || t('apiClient.selectFile')}
                      </span>
                      {#if item.file}
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                          ({(item.file.size / 1024).toFixed(2)} KB)
                        </span>
                      {/if}
                    </label>
                  {/if}
                  <button
                    onclick={() => removeFormDataItem(activeTab, index)}
                    class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    disabled={activeTab.formData.length === 1}
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              {/each}
              <button
                onclick={() => addFormDataItem(activeTab)}
                class="btn-secondary text-sm"
              >
                {t('apiClient.addFormData')}
              </button>
            </div>
          {/if}
        </div>
      {/if}

      {#if activeTab.error}
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-800 dark:text-red-200">{activeTab.error}</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- 响应卡片 -->
  {#if activeTab.responseStatus !== null || activeTab.responseBody}
    <div class="card">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('apiClient.response')}
          </h3>
          {#if activeTab.responseTime !== null}
            <span class="text-sm text-gray-500 dark:text-gray-400">
              {activeTab.responseTime}ms
            </span>
          {/if}
        </div>

        {#if activeTab.responseStatus !== null}
          <div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('apiClient.status')}:
            </span>
            <span class="ml-2 font-semibold {getStatusColor(activeTab.responseStatus)}">
              {activeTab.responseStatus}
            </span>
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 响应头 -->
          <div class="flex flex-col">
            <div class="flex items-center justify-between mb-2 h-[2.5rem]">
              <div class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('apiClient.responseHeaders')}
              </div>
              <div class="w-0"></div>
            </div>
            <div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 h-[calc(100vh-400px)] min-h-[300px] overflow-y-auto {Object.keys(activeTab.responseHeaders).length === 0 ? 'flex items-center justify-center' : ''}">
              {#if Object.keys(activeTab.responseHeaders).length > 0}
                {#each Object.entries(activeTab.responseHeaders) as [key, value]}
                  <div class="text-sm font-mono py-1">
                    <span class="text-gray-600 dark:text-gray-400">{key}:</span>
                    <span class="ml-2 text-gray-900 dark:text-gray-100">{value}</span>
                  </div>
                {/each}
              {:else}
                <span class="text-sm text-gray-400 dark:text-gray-500">{t('apiClient.noHeaders')}</span>
              {/if}
            </div>
          </div>

          <!-- 响应体 -->
          <div class="flex flex-col">
            <div class="flex items-center justify-between mb-2 h-[2.5rem]">
              <div class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('apiClient.responseBody')}
              </div>
              {#if activeTab.responseBody}
                <button
                  onclick={() => copyResponse(activeTab)}
                  class="btn-secondary whitespace-nowrap transition-all duration-200 {activeTab.copied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
                >
                  {#if activeTab.copied}
                    <span class="flex items-center gap-1">
                      <Check class="w-4 h-4" />
                      {t('common.copied')}
                    </span>
                  {:else}
                    <span class="flex items-center gap-1">
                      <Copy class="w-4 h-4" />
                      {t('common.copy')}
                    </span>
                  {/if}
                </button>
              {:else}
                <div class="w-0"></div>
              {/if}
            </div>
            {#if activeTab.responseBody}
              <textarea
                value={activeTab.responseBody}
                readonly
                class="textarea font-mono text-sm h-[calc(100vh-400px)] min-h-[300px] resize-none {activeTab.copied ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''} transition-colors duration-300"
              ></textarea>
            {:else}
              <div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 h-[calc(100vh-400px)] min-h-[300px] overflow-y-auto flex items-center justify-center">
                <span class="text-sm text-gray-400 dark:text-gray-500">{t('apiClient.noResponseBody')}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

