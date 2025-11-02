<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  type Base = 2 | 8 | 10 | 16;
  
  let inputBase = $state<Base>(10);
  let outputBase = $state<Base>(16);
  let inputValue = $state('');
  let outputValue = $state('');
  let error = $state('');
  let copied = $state(false);

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // 获取基数的显示名称
  function getBaseName(base: Base): string {
    const names: Record<Base, string> = {
      2: t('baseConverter.binary'),
      8: t('baseConverter.octal'),
      10: t('baseConverter.decimal'),
      16: t('baseConverter.hexadecimal')
    };
    return names[base];
  }

  // 验证输入值是否符合指定进制
  function validateInput(value: string, base: Base): boolean {
    if (!value.trim()) {
      return true; // 空值允许
    }

    const trimmed = value.trim().toUpperCase();
    
    // 移除进制前缀（如果存在）
    const cleanValue = trimmed
      .replace(/^0[Bb]/, '') // 二进制前缀 0b
      .replace(/^0[Oo]/, '') // 八进制前缀 0o
      .replace(/^0[Xx]/, '') // 十六进制前缀 0x
      .replace(/^0+/, ''); // 前导零

    if (!cleanValue) {
      return true; // 只有前缀或零，允许
    }

    // 验证字符
    const validChars: Record<Base, RegExp> = {
      2: /^[01]+$/,
      8: /^[0-7]+$/,
      10: /^-?[0-9]+$/,
      16: /^[0-9A-F]+$/
    };

    return validChars[base].test(cleanValue);
  }

  // 解析输入值（移除前缀，转换为十进制）
  function parseInput(value: string, base: Base): number | null {
    if (!value.trim()) {
      return null;
    }

    const trimmed = value.trim().toUpperCase();
    
    // 移除进制前缀
    let cleanValue = trimmed
      .replace(/^0[Bb]/, '') // 二进制前缀 0b
      .replace(/^0[Oo]/, '') // 八进制前缀 0o
      .replace(/^0[Xx]/, '') // 十六进制前缀 0x
      .replace(/^0+/, ''); // 前导零

    if (!cleanValue) {
      return 0;
    }

    try {
      // 处理负数（十进制）
      let isNegative = false;
      if (base === 10 && cleanValue.startsWith('-')) {
        isNegative = true;
        cleanValue = cleanValue.substring(1);
      }

      const decimal = parseInt(cleanValue, base);
      return isNegative ? -decimal : decimal;
    } catch {
      return null;
    }
  }

  // 将十进制数转换为指定进制
  function convertToBase(decimal: number, base: Base): string {
    if (decimal === 0) {
      return '0';
    }

    let num = Math.abs(decimal);
    let result = '';

    if (base === 10) {
      return decimal.toString();
    }

    while (num > 0) {
      const remainder = num % base;
      if (base === 16) {
        result = (remainder < 10 ? remainder.toString() : String.fromCharCode(65 + remainder - 10)) + result;
      } else {
        result = remainder.toString() + result;
      }
      num = Math.floor(num / base);
    }

    // 添加符号
    if (decimal < 0) {
      result = '-' + result;
    }

    return result;
  }

  // 格式化输出（添加前缀）
  function formatOutput(value: string, base: Base): string {
    if (!value || value === '0') {
      return '0';
    }

    const prefixes: Record<Base, string> = {
      2: '0b',
      8: '0o',
      10: '',
      16: '0x'
    };

    const prefix = prefixes[base];
    return prefix ? prefix + value.toUpperCase() : value;
  }

  // 转换进制
  function convertBase() {
    error = '';
    outputValue = '';

    if (!inputValue.trim()) {
      return;
    }

    // 验证输入
    if (!validateInput(inputValue, inputBase)) {
      error = t('baseConverter.invalidInput').replace('{base}', getBaseName(inputBase));
      return;
    }

    // 解析输入
    const decimal = parseInput(inputValue, inputBase);
    if (decimal === null) {
      error = t('baseConverter.parseError');
      return;
    }

    try {
      // 转换为目标进制
      const converted = convertToBase(decimal, outputBase);
      outputValue = formatOutput(converted, outputBase);
    } catch (e) {
      error = e instanceof Error ? e.message : t('baseConverter.convertError');
    }
  }

  // 监听输入变化
  $effect(() => {
    convertBase();
  });

  async function copyToClipboard() {
    if (!outputValue) return;
    
    try {
      await navigator.clipboard.writeText(outputValue);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clear() {
    inputValue = '';
    outputValue = '';
    error = '';
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <div class="card flex-1 flex flex-col">
    <div class="flex-1 flex flex-col space-y-4">
      <!-- 进制选择 -->
      <div class="flex gap-4 items-center">
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('baseConverter.inputBase')}
          </label>
          <select
            bind:value={inputBase}
            class="input"
          >
            <option value="2">{t('baseConverter.binary')} (2)</option>
            <option value="8">{t('baseConverter.octal')} (8)</option>
            <option value="10">{t('baseConverter.decimal')} (10)</option>
            <option value="16">{t('baseConverter.hexadecimal')} (16)</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('baseConverter.outputBase')}
          </label>
          <select
            bind:value={outputBase}
            class="input"
          >
            <option value="2">{t('baseConverter.binary')} (2)</option>
            <option value="8">{t('baseConverter.octal')} (8)</option>
            <option value="10">{t('baseConverter.decimal')} (10)</option>
            <option value="16">{t('baseConverter.hexadecimal')} (16)</option>
          </select>
        </div>
      </div>

      <!-- 左右布局：输入 - 输出 -->
      <div class="flex-1 grid grid-cols-12 gap-4 items-stretch">
        <!-- 左侧输入区域 -->
        <div class="col-span-5 flex flex-col space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-base font-bold text-gray-700 dark:text-gray-300">
              {t('baseConverter.input')} ({getBaseName(inputBase)})
            </label>
          </div>
          <div class="relative flex-1">
            <textarea
              bind:value={inputValue}
              placeholder={t('baseConverter.inputPlaceholder')}
              class="textarea h-full resize-none font-mono text-sm"
            ></textarea>
          </div>
        </div>

        <!-- 中间箭头区域 -->
        <div class="col-span-2 flex flex-col justify-center items-center gap-3 px-2">
          <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <button onclick={clear} class="btn-secondary">
            {t('baseConverter.clear')}
          </button>
        </div>

        <!-- 右侧输出区域 -->
        <div class="col-span-5 flex flex-col space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-base font-bold text-gray-700 dark:text-gray-300">
              {t('baseConverter.output')} ({getBaseName(outputBase)})
            </label>
            {#if outputValue}
              <button
                onclick={copyToClipboard}
                class="btn-secondary text-xs px-3 py-1.5 transition-all duration-200 {copied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
              >
                {#if copied}
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
            {/if}
          </div>
          <div class="relative flex-1">
            <textarea
              readonly
              value={outputValue}
              class="textarea h-full resize-none font-mono text-sm bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed"
            ></textarea>
          </div>
        </div>
      </div>

      {#if error}
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

