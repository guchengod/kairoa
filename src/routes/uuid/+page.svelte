<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  type GeneratorType = 'uuid' | 'ulid';
  
  let generatorType = $state<GeneratorType>('uuid');
  let count = $state(1);
  let uuids = $state<string[]>([]);
  let copiedUuids = $state<Set<number>>(new Set());
  let allCopied = $state(false);
  let includeHyphens = $state(true);

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // Base32 字符集（ULID 使用，排除 I, L, O, U）
  const BASE32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  function encodeBase32(value: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      const remainder = value % 32;
      result = BASE32_CHARS[remainder] + result;
      value = Math.floor(value / 32);
    }
    return result;
  }

  function generateULID(): string {
    // 时间戳部分（48 位，10 个 Base32 字符）
    const timestamp = Date.now();
    
    // ULID 使用 48 位时间戳（从 Unix 纪元开始的毫秒数）
    // 当前时间戳约为 13 位数字，远小于 48 位最大值
    // 48 位最大值：281474976710655 (可以表示到 8925 年)
    // 直接使用时间戳，不需要截断
    const timePart = encodeBase32(timestamp, 10);

    // 随机部分（80 位，16 个 Base32 字符）
    let randomPart = '';
    const randomBytes = new Uint8Array(10);
    crypto.getRandomValues(randomBytes);
    
    // 将 10 字节（80 位）转换为 16 个 Base32 字符
    // 每次处理 5 位（Base32）
    let randomValue = 0;
    let bitCount = 0;
    for (let i = 0; i < 10; i++) {
      randomValue = (randomValue << 8) | randomBytes[i];
      bitCount += 8;
      
      while (bitCount >= 5) {
        randomPart += BASE32_CHARS[randomValue & 0x1f];
        randomValue = randomValue >>> 5;
        bitCount -= 5;
      }
    }
    
    // 处理剩余的位数（确保有 16 个字符）
    if (bitCount > 0) {
      randomPart += BASE32_CHARS[randomValue & 0x1f];
    }
    
    // 确保随机部分是 16 个字符
    while (randomPart.length < 16) {
      randomPart = BASE32_CHARS[Math.floor(Math.random() * 32)] + randomPart;
    }
    randomPart = randomPart.slice(-16);

    return timePart + randomPart;
  }

  function generateUUID() {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return includeHyphens ? uuid : uuid.replace(/-/g, '');
  }

  function generate() {
    uuids = [];
    copiedUuids = new Set();
    for (let i = 0; i < count; i++) {
      if (generatorType === 'uuid') {
        uuids.push(generateUUID());
      } else {
        uuids.push(generateULID());
      }
    }
  }

  async function copyToClipboard(index: number, uuid: string) {
    try {
      await navigator.clipboard.writeText(uuid);
      copiedUuids = new Set(copiedUuids);
      copiedUuids.add(index);
      setTimeout(() => {
        copiedUuids = new Set(copiedUuids);
        copiedUuids.delete(index);
      }, 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  async function copyAll() {
    if (uuids.length === 0) return;
    
    try {
      const allUuids = uuids.join('\n');
      await navigator.clipboard.writeText(allUuids);
      allCopied = true;
      setTimeout(() => {
        allCopied = false;
      }, 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clear() {
    uuids = [];
    copiedUuids = new Set();
    allCopied = false;
  }
</script>

<div class="w-full ml-0 mr-0 p-2 space-y-6">
  <!-- 输入区域卡片 -->
  <div class="card">
    <div class="space-y-4">
      <!-- 类型切换 -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <div class="flex gap-6">
          <button
            onclick={() => { generatorType = 'uuid'; clear(); }}
            class="px-4 py-2 relative transition-colors font-medium {generatorType === 'uuid'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
          >
            UUID
            {#if generatorType === 'uuid'}
              <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"></span>
            {/if}
          </button>
          <button
            onclick={() => { generatorType = 'ulid'; clear(); }}
            class="px-4 py-2 relative transition-colors font-medium {generatorType === 'ulid'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
          >
            ULID
            {#if generatorType === 'ulid'}
              <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"></span>
            {/if}
          </button>
        </div>
      </div>

      <div>
        <label for="uuid-count" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('uuid.count')}
        </label>
        <input
          id="uuid-count"
          type="number"
          bind:value={count}
          min="1"
          max="100"
          class="input w-32"
        />
      </div>

      {#if generatorType === 'uuid'}
        <div class="flex items-center">
          <input
            id="include-hyphens"
            type="checkbox"
            bind:checked={includeHyphens}
            class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <label for="include-hyphens" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            {t('uuid.includeHyphens')}
          </label>
        </div>
      {/if}

      <div class="flex gap-2">
        <button 
          onclick={generate} 
          disabled={count < 1 || count > 100}
          class="px-4 py-2 text-white rounded-lg transition-colors font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style="background-color: #818089;"
        >
          {t('uuid.generate')}
        </button>
        <button onclick={clear} class="btn-secondary">
          {t('uuid.clear')}
        </button>
      </div>
    </div>
  </div>

  <!-- UUID 结果卡片 -->
  {#if uuids.length > 0}
    <div class="card">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {generatorType === 'uuid' ? t('uuid.generated') : t('uuid.generatedULID')}
          </h3>
          {#if uuids.length > 1}
            <button
              onclick={copyAll}
              class="btn-secondary whitespace-nowrap transition-all duration-200 {allCopied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
            >
              {#if allCopied}
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  {t('common.copied')}
                </span>
              {:else}
                {t('uuid.copyAll')}
              {/if}
            </button>
          {/if}
        </div>
        
        <div class="space-y-2">
          {#each uuids as uuidItem, index}
            {@const isCopied = copiedUuids.has(index)}
            <div class="flex gap-2 items-center {isCopied ? 'ring-2 ring-green-500 ring-offset-2 rounded-lg p-2 -m-2' : ''} transition-all duration-300">
              <input
                type="text"
                value={uuidItem}
                readonly
                class="input font-mono text-sm flex-1 {isCopied ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''} transition-colors duration-300"
              />
              <button
                onclick={() => copyToClipboard(index, uuidItem)}
                class="btn-secondary whitespace-nowrap transition-all duration-200 {isCopied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
              >
                {#if isCopied}
                  <span class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    {t('common.copied')}
                  </span>
                {:else}
                  {t('common.copy')}
                {/if}
              </button>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

