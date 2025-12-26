<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Send, Trash2, Play, Square, Download } from 'lucide-svelte';
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

  let wsUrl = $state('');
  let messageInput = $state('');
  let messages = $state<Array<{ type: 'sent' | 'received' | 'system'; content: string; timestamp: number }>>([]);
  let isConnected = $state(false);
  let ws: WebSocket | null = null;
  let copied = $state(false);
  const STORAGE_KEY = 'websocket.state.v1';
  let hasLoadedFromStorage = false;

  // 从本地存储恢复状态
  function loadSavedState() {
    if (!browser || hasLoadedFromStorage) return;
    hasLoadedFromStorage = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { url?: string; messages?: typeof messages };
        if (typeof parsed.url === 'string') wsUrl = parsed.url;
        // 不恢复消息历史，避免数据过多
      }
    } catch (error) {
      console.error('Failed to load WebSocket state:', error);
    }
  }

  // 保存状态
  function saveState() {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: wsUrl }));
    } catch (error) {
      console.error('Failed to save WebSocket state:', error);
    }
  }

  // 初始化时加载保存的状态
  loadSavedState();

  // URL 变化时保存
  $effect(() => {
    wsUrl;
    saveState();
  });

  function addMessage(type: 'sent' | 'received' | 'system', content: string) {
    messages = [...messages, { type, content, timestamp: Date.now() }];
    // 自动滚动到底部
    setTimeout(() => {
      const container = document.getElementById('messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  function connect() {
    if (!wsUrl.trim()) {
      addMessage('system', t('websocket.errors.urlRequired'));
      return;
    }

    try {
      ws = new WebSocket(wsUrl);
      isConnected = false;

      ws.onopen = () => {
        isConnected = true;
        addMessage('system', t('websocket.connected'));
      };

      ws.onmessage = (event) => {
        addMessage('received', event.data);
      };

      ws.onerror = (error) => {
        addMessage('system', t('websocket.errors.connectionFailed'));
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        isConnected = false;
        if (event.wasClean) {
          addMessage('system', t('websocket.disconnected'));
        } else {
          addMessage('system', t('websocket.errors.connectionClosed'));
        }
        ws = null;
      };
    } catch (error) {
      addMessage('system', t('websocket.errors.invalidUrl'));
      console.error('Failed to connect:', error);
    }
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
      isConnected = false;
    }
  }

  function sendMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addMessage('system', t('websocket.errors.notConnected'));
      return;
    }

    if (!messageInput.trim()) {
      return;
    }

    try {
      ws.send(messageInput);
      addMessage('sent', messageInput);
      messageInput = '';
    } catch (error) {
      addMessage('system', t('websocket.errors.sendFailed'));
      console.error('Failed to send message:', error);
    }
  }

  function clearMessages() {
    messages = [];
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  async function exportMessages() {
    if (messages.length === 0) return;

    const content = messages
      .map((msg) => {
        const time = formatTimestamp(msg.timestamp);
        const type = msg.type === 'sent' ? '→' : msg.type === 'received' ? '←' : '•';
        return `[${time}] ${type} ${msg.content}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(content);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to export messages:', error);
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="flex flex-col h-full w-full p-2">
  <div class="card flex-1 flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('websocket.title')}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('websocket.description')}</p>
      </div>
      {#if messages.length > 0}
        <div class="flex items-center gap-2">
          <button
            onclick={exportMessages}
            class="btn-secondary text-sm transition-all duration-200 {copied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
            title={t('websocket.exportMessages')}
          >
            {#if copied}
              <Check class="w-4 h-4 inline mr-1" />
              {t('common.copied')}
            {:else}
              <Download class="w-4 h-4 inline mr-1" />
              {t('websocket.exportMessages')}
            {/if}
          </button>
          <button type="button" class="btn-secondary text-sm" onclick={clearMessages}>
            <Trash2 class="w-4 h-4 inline mr-1" />
            {t('websocket.clear')}
          </button>
        </div>
      {/if}
    </div>

    <div class="space-y-4">
      <!-- 连接区域 -->
      <div>
        <label for="ws-url" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('websocket.url')}
        </label>
        <div class="flex gap-2">
          <input
            id="ws-url"
            type="text"
            bind:value={wsUrl}
            placeholder={t('websocket.urlPlaceholder')}
            class="input flex-1"
            disabled={isConnected}
          />
          {#if isConnected}
            <button onclick={disconnect} class="btn-secondary">
              <Square class="w-4 h-4 inline mr-1" />
              {t('websocket.disconnect')}
            </button>
          {:else}
            <button onclick={connect} class="btn-secondary">
              <Play class="w-4 h-4 inline mr-1" />
              {t('websocket.connect')}
            </button>
          {/if}
        </div>
      </div>

      <!-- 消息发送区域 -->
      {#if isConnected}
        <div>
          <label for="message-input" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('websocket.message')}
          </label>
          <div class="flex gap-2">
            <textarea
              id="message-input"
              bind:value={messageInput}
              placeholder={t('websocket.messagePlaceholder')}
              class="textarea flex-1 min-h-[80px]"
              onkeydown={handleKeyPress}
            ></textarea>
            <button onclick={sendMessage} class="btn-secondary self-end" disabled={!messageInput.trim()}>
              <Send class="w-4 h-4 inline mr-1" />
              {t('websocket.send')}
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('websocket.sendHint')}
          </p>
        </div>
      {/if}

      <!-- 消息列表 -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('websocket.messages')}
          </div>
          {#if messages.length > 0}
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {messages.length} {t('websocket.messageCount')}
            </span>
          {/if}
        </div>
        <div
          id="messages-container"
          class="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 p-4 h-[400px] overflow-y-auto font-mono text-sm"
        >
          {#if messages.length === 0}
            <div class="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
              {t('websocket.noMessages')}
            </div>
          {:else}
            {#each messages as msg}
              <div class="mb-2 flex items-start gap-2">
                <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {formatTimestamp(msg.timestamp)}
                </span>
                <span
                  class="flex-shrink-0 {msg.type === 'sent'
                    ? 'text-blue-600 dark:text-blue-400'
                    : msg.type === 'received'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'}"
                >
                  {msg.type === 'sent' ? '→' : msg.type === 'received' ? '←' : '•'}
                </span>
                <span class="text-gray-900 dark:text-gray-100 break-words flex-1">
                  {msg.content}
                </span>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
