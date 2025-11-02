<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Check, Copy } from 'lucide-svelte';
  
  type KeySize = 1024 | 2048 | 3072 | 4096;
  type KeyFormat = 'pem' | 'der';
  
  let keySize = $state<KeySize>(2048);
  let keyFormat = $state<KeyFormat>('pem');
  let publicKey = $state('');
  let privateKey = $state('');
  let isGenerating = $state(false);
  let publicKeyCopied = $state(false);
  let privateKeyCopied = $state(false);

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // 将 ArrayBuffer 转换为 Base64
  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // 将 ArrayBuffer 转换为十六进制字符串
  function arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      const byte = bytes[i];
      hex += (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase();
    }
    return hex;
  }

  // 格式化十六进制字符串（每 32 个字符换行）
  function formatHex(hex: string): string {
    const chunks = [];
    for (let i = 0; i < hex.length; i += 32) {
      chunks.push(hex.slice(i, i + 32));
    }
    return chunks.join('\n');
  }

  // 将 Base64 转换为 PEM 格式
  function base64ToPEM(base64: string, type: 'PUBLIC' | 'PRIVATE'): string {
    const header = type === 'PUBLIC' 
      ? '-----BEGIN PUBLIC KEY-----\n'
      : '-----BEGIN PRIVATE KEY-----\n';
    const footer = type === 'PUBLIC'
      ? '\n-----END PUBLIC KEY-----'
      : '\n-----END PRIVATE KEY-----';
    
    // 每 64 个字符换行
    const chunks = [];
    for (let i = 0; i < base64.length; i += 64) {
      chunks.push(base64.slice(i, i + 64));
    }
    
    return header + chunks.join('\n') + footer;
  }

  // 导出公钥
  async function exportPublicKey(key: CryptoKey, format: KeyFormat): Promise<string> {
    const exported = await crypto.subtle.exportKey('spki', key);
    
    if (format === 'pem') {
      const base64 = arrayBufferToBase64(exported);
      return base64ToPEM(base64, 'PUBLIC');
    } else {
      // DER 格式显示为十六进制
      return formatHex(arrayBufferToHex(exported));
    }
  }

  // 导出私钥
  async function exportPrivateKey(key: CryptoKey, format: KeyFormat): Promise<string> {
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    
    if (format === 'pem') {
      const base64 = arrayBufferToBase64(exported);
      return base64ToPEM(base64, 'PRIVATE');
    } else {
      // DER 格式显示为十六进制
      return formatHex(arrayBufferToHex(exported));
    }
  }

  async function generateKeyPair() {
    isGenerating = true;
    publicKey = '';
    privateKey = '';
    publicKeyCopied = false;
    privateKeyCopied = false;

    try {
      // 生成 RSA 密钥对
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: keySize,
          publicExponent: new Uint8Array([1, 0, 1]), // 65537
          hash: 'SHA-256',
        },
        true, // 可导出
        ['encrypt', 'decrypt']
      );

      // 导出密钥对
      publicKey = await exportPublicKey(keyPair.publicKey, keyFormat);
      privateKey = await exportPrivateKey(keyPair.privateKey, keyFormat);
    } catch (error) {
      console.error('Error generating key pair:', error);
      publicKey = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      privateKey = '';
    } finally {
      isGenerating = false;
    }
  }

  async function copyToClipboard(text: string, type: 'public' | 'private') {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'public') {
        publicKeyCopied = true;
        setTimeout(() => {
          publicKeyCopied = false;
        }, 2000);
      } else {
        privateKeyCopied = true;
        setTimeout(() => {
          privateKeyCopied = false;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clear() {
    publicKey = '';
    privateKey = '';
    publicKeyCopied = false;
    privateKeyCopied = false;
  }
</script>

<div class="w-full ml-0 mr-0 p-2 space-y-6">
  <!-- 配置区域卡片 -->
  <div class="card">
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="key-size" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('rsa.keySize')}
          </label>
          <select
            id="key-size"
            bind:value={keySize}
            class="input w-full"
          >
            <option value={1024}>1024 bits</option>
            <option value={2048}>2048 bits</option>
            <option value={3072}>3072 bits</option>
            <option value={4096}>4096 bits</option>
          </select>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('rsa.keySizeDescription')}
          </p>
        </div>

        <div>
          <label for="key-format" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('rsa.keyFormat')}
          </label>
          <select
            id="key-format"
            bind:value={keyFormat}
            class="input w-full"
          >
            <option value="pem">PEM</option>
            <option value="der">DER (Hex)</option>
          </select>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('rsa.keyFormatDescription')}
          </p>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          onclick={generateKeyPair}
          disabled={isGenerating}
          class="px-4 py-2 text-white rounded-lg transition-colors font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style="background-color: #818089;"
        >
          {#if isGenerating}
            {t('rsa.generating')}
          {:else}
            {t('rsa.generate')}
          {/if}
        </button>
        <button
          onclick={clear}
          disabled={isGenerating}
          class="btn-secondary"
        >
          {t('rsa.clear')}
        </button>
      </div>
    </div>
  </div>

  <!-- 公钥卡片 -->
  {#if publicKey}
    <div class="card">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('rsa.publicKey')}
          </h3>
          <button
            onclick={() => copyToClipboard(publicKey, 'public')}
            class="btn-secondary whitespace-nowrap transition-all duration-200 {publicKeyCopied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
          >
            {#if publicKeyCopied}
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
        </div>

        <textarea
          value={publicKey}
          readonly
          class="textarea font-mono text-sm min-h-[120px] {publicKeyCopied ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''} transition-colors duration-300"
        ></textarea>
      </div>
    </div>
  {/if}

  <!-- 私钥卡片 -->
  {#if privateKey}
    <div class="card">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('rsa.privateKey')}
          </h3>
          <button
            onclick={() => copyToClipboard(privateKey, 'private')}
            class="btn-secondary whitespace-nowrap transition-all duration-200 {privateKeyCopied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
          >
            {#if privateKeyCopied}
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
        </div>

        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-2">
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>{t('rsa.warning')}</strong> {t('rsa.warningDescription')}
          </p>
        </div>

        <textarea
          value={privateKey}
          readonly
          class="textarea font-mono text-sm min-h-[200px] {privateKeyCopied ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''} transition-colors duration-300"
        ></textarea>
      </div>
    </div>
  {/if}
</div>

