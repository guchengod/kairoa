<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  type ConversionType = 'timestamp' | 'date';
  
  let conversionType = $state<ConversionType>('timestamp');
  let timestampInput = $state('');
  let dateInput = $state('');
  let timezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
  let timestampResult = $state('');
  let dateResult = $state<{ spaceFormat: string; isoFormat: string } | null>(null);
  let timestampCopied = $state(false);
  let dateCopiedSpace = $state(false);
  let dateCopiedIso = $state(false);
  let timezoneSearchTimestamp = $state('');
  let timezoneSearchDate = $state('');
  let timezoneOpenTimestamp = $state(false);
  let timezoneOpenDate = $state(false);
  let timezoneDropdownRefTimestamp = $state<HTMLDivElement | null>(null);
  let timezoneDropdownRefDate = $state<HTMLDivElement | null>(null);

  // 获取所有 IANA 时区列表
  const timezones = Intl.supportedValuesOf('timeZone').sort();
  
  // 确保当前时区在列表中（通常在列表中，但为了保险）
  const availableTimezones = $derived(() => {
    const tz = timezone;
    if (!timezones.includes(tz)) {
      return [tz, ...timezones];
    }
    return timezones;
  });

  // 过滤时区列表
  function filterTimezones(search: string): string[] {
    const tzList = availableTimezones;
    if (!search.trim()) {
      return tzList;
    }
    const lowerSearch = search.toLowerCase();
    return tzList.filter(tz => tz.toLowerCase().includes(lowerSearch));
  }

  const filteredTimezonesTimestamp = $derived(filterTimezones(timezoneSearchTimestamp));
  const filteredTimezonesDate = $derived(filterTimezones(timezoneSearchDate));

  function selectTimezone(tz: string, type: 'timestamp' | 'date') {
    timezone = tz;
    if (type === 'timestamp') {
      timezoneSearchTimestamp = '';
      timezoneOpenTimestamp = false;
    } else {
      timezoneSearchDate = '';
      timezoneOpenDate = false;
    }
  }

  // 点击外部关闭下拉列表
  function handleClickOutside(event: MouseEvent, type: 'timestamp' | 'date') {
    const ref = type === 'timestamp' ? timezoneDropdownRefTimestamp : timezoneDropdownRefDate;
    if (ref && !ref.contains(event.target as Node)) {
      if (type === 'timestamp') {
        timezoneOpenTimestamp = false;
      } else {
        timezoneOpenDate = false;
      }
    }
  }

  // 初始化点击外部监听
  $effect(() => {
    if (timezoneOpenTimestamp || timezoneOpenDate) {
      const handler = (e: MouseEvent) => {
        handleClickOutside(e, 'timestamp');
        handleClickOutside(e, 'date');
      };
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
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

  function formatDate(date: Date, tz: string): { spaceFormat: string; isoFormat: string } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // 格式化日期，得到类似 "MM/DD/YYYY, HH:mm:ss" 的格式
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value.padStart(2, '0') || '';
    const day = parts.find(p => p.type === 'day')?.value.padStart(2, '0') || '';
    const hour = parts.find(p => p.type === 'hour')?.value.padStart(2, '0') || '';
    const minute = parts.find(p => p.type === 'minute')?.value.padStart(2, '0') || '';
    const second = parts.find(p => p.type === 'second')?.value.padStart(2, '0') || '';
    
    const spaceFormat = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    const isoFormat = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    
    return { spaceFormat, isoFormat };
  }

  function convertTimestampToDate() {
    if (!timestampInput.trim()) {
      dateResult = null;
      return;
    }

    try {
      const ts = parseInt(timestampInput);
      if (isNaN(ts)) {
        dateResult = { spaceFormat: 'Invalid timestamp', isoFormat: 'Invalid timestamp' };
        return;
      }

      // 如果时间戳是10位数字，认为是秒；如果是13位，认为是毫秒
      const timestamp = ts.toString().length === 10 ? ts * 1000 : ts;
      const date = new Date(timestamp);
      
      if (isNaN(date.getTime())) {
        dateResult = { spaceFormat: 'Invalid timestamp', isoFormat: 'Invalid timestamp' };
        return;
      }

      dateResult = formatDate(date, timezone);
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      dateResult = { spaceFormat: errorMsg, isoFormat: errorMsg };
    }
  }

  function convertDateToTimestamp() {
    if (!dateInput.trim()) {
      timestampResult = '';
      return;
    }

    try {
      // 支持多种日期格式输入
      let dateStr = dateInput.trim();
      
      // 如果输入格式是 YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DDTHH:mm，直接使用
      // 如果输入格式是 YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DD HH:mm，转换为标准格式
      dateStr = dateStr.replace(' ', 'T');
      
      // 如果只有日期部分，添加默认时间 00:00:00
      if (!dateStr.includes('T')) {
        dateStr = dateStr + 'T00:00:00';
      }
      
      // 解析日期字符串
      const [datePart, timePart] = dateStr.split('T');
      if (!datePart) {
        timestampResult = 'Invalid date format';
        return;
      }
      
      const [year, month, day] = datePart.split('-').map(Number);
      const timeParts = (timePart || '00:00:00').split(':');
      const hour = Number(timeParts[0] || 0);
      const minute = Number(timeParts[1] || 0);
      const second = Number(timeParts[2] || 0);
      
      // 构造一个 ISO 格式的日期字符串
      const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      
      // 创建一个临时日期对象来获取时区信息
      // 首先创建一个本地时间的 Date 对象
      const localDate = new Date(isoString);
      
      if (isNaN(localDate.getTime())) {
        timestampResult = 'Invalid date';
        return;
      }

      // 获取当前本地时区和指定时区的偏移量差
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // 获取指定时区的偏移量（相对于 UTC，单位：分钟）
      const targetOffset = getTimezoneOffset(timezone);
      const localOffset = getTimezoneOffset(localTimezone);
      
      // 计算时区差异
      const offsetDiff = (targetOffset - localOffset) * 60000;
      
      // 将本地时间转换为 UTC，然后应用时区差异
      const utcTime = localDate.getTime() - offsetDiff;
      const ts = Math.floor(utcTime / 1000);
      
      timestampResult = ts.toString();
    } catch (error) {
      timestampResult = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  function getTimezoneOffset(tz: string): number {
    // 获取指定时区相对于 UTC 的偏移量（分钟）
    // 使用当前时间来计算，考虑夏令时
    const now = new Date();
    const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    return (tzTime.getTime() - utcTime.getTime()) / 60000;
  }

  function setCurrentTime() {
    const now = new Date();
    const ts = Math.floor(now.getTime() / 1000);
    timestampInput = ts.toString();
    convertTimestampToDate();
  }

  function clear() {
    if (conversionType === 'timestamp') {
      timestampInput = '';
      dateResult = null;
    } else {
      dateInput = '';
      timestampResult = '';
    }
  }

  function switchConversionType(type: ConversionType) {
    conversionType = type;
    timestampInput = '';
    dateInput = '';
    timestampResult = '';
    dateResult = null;
  }

  async function copyToClipboard(text: string, type: 'timestamp' | 'date-space' | 'date-iso') {
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'timestamp') {
        timestampCopied = true;
        setTimeout(() => { timestampCopied = false; }, 1000);
      } else if (type === 'date-space') {
        dateCopiedSpace = true;
        setTimeout(() => { dateCopiedSpace = false; }, 1000);
      } else if (type === 'date-iso') {
        dateCopiedIso = true;
        setTimeout(() => { dateCopiedIso = false; }, 1000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // 监听输入变化，自动转换
  $effect(() => {
    if (conversionType === 'timestamp' && timestampInput) {
      convertTimestampToDate();
    } else {
      dateResult = null;
    }
  });

  $effect(() => {
    if (conversionType === 'date' && dateInput) {
      convertDateToTimestamp();
    } else {
      timestampResult = '';
    }
  });

  $effect(() => {
    if (timezone) {
      if (conversionType === 'timestamp' && timestampInput) {
        convertTimestampToDate();
      }
      if (conversionType === 'date' && dateInput) {
        convertDateToTimestamp();
      }
    }
  });
</script>

<div class="w-full ml-0 mr-0 p-2 space-y-6">
  <!-- 输入区域卡片 -->
  <div class="card">
    <div class="space-y-4">
      <!-- 转换类型切换 -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <div class="flex gap-6">
          <button
            onclick={() => switchConversionType('timestamp')}
            class="px-4 py-2 relative transition-colors font-medium {conversionType === 'timestamp'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
          >
            {t('time.timestampToDate')}
            {#if conversionType === 'timestamp'}
              <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"></span>
            {/if}
          </button>
          <button
            onclick={() => switchConversionType('date')}
            class="px-4 py-2 relative transition-colors font-medium {conversionType === 'date'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
          >
            {t('time.dateToTimestamp')}
            {#if conversionType === 'date'}
              <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400"></span>
            {/if}
          </button>
        </div>
      </div>

      {#if conversionType === 'timestamp'}
        <!-- 时间戳转日期 -->
        <div class="space-y-4">
          <div>
            <input
              id="timestamp-input"
              type="text"
              bind:value={timestampInput}
              placeholder={t('time.timestamp')}
              class="input"
            />
          </div>
          
          <div>
            <div class="relative" bind:this={timezoneDropdownRefTimestamp}>
              <input
                type="text"
                value={timezoneOpenTimestamp ? timezoneSearchTimestamp : timezone}
                oninput={(e) => {
                  timezoneSearchTimestamp = (e.target as HTMLInputElement).value;
                  timezoneOpenTimestamp = true;
                }}
                onfocus={() => {
                  timezoneOpenTimestamp = true;
                  timezoneSearchTimestamp = '';
                }}
                placeholder={t('time.searchTimezone')}
                class="input w-full"
              />
              {#if timezoneOpenTimestamp}
                <div class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {#if filteredTimezonesTimestamp.length > 0}
                    {#each filteredTimezonesTimestamp as tz}
                      <button
                        type="button"
                        onclick={() => selectTimezone(tz, 'timestamp')}
                        class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 {timezone === tz ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100'}"
                      >
                        {tz}
                      </button>
                    {/each}
                  {:else}
                    <div class="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
                      {t('time.noTimezoneFound')}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          
          <div class="flex gap-2">
            <button 
              onclick={setCurrentTime}
              class="btn-secondary"
              style="background-color: #818089; color: white;"
            >
              {t('time.now')}
            </button>
            <button onclick={clear} class="btn-secondary">
              {t('time.clear')}
            </button>
          </div>
        </div>
      {:else}
        <!-- 日期转时间戳 -->
        <div class="space-y-4">
          <div>
            <div class="relative" bind:this={timezoneDropdownRefDate}>
              <input
                type="text"
                value={timezoneOpenDate ? timezoneSearchDate : timezone}
                oninput={(e) => {
                  timezoneSearchDate = (e.target as HTMLInputElement).value;
                  timezoneOpenDate = true;
                }}
                onfocus={() => {
                  timezoneOpenDate = true;
                  timezoneSearchDate = '';
                }}
                placeholder={t('time.searchTimezone')}
                class="input w-full"
              />
              {#if timezoneOpenDate}
                <div class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {#if filteredTimezonesDate.length > 0}
                    {#each filteredTimezonesDate as tz}
                      <button
                        type="button"
                        onclick={() => selectTimezone(tz, 'date')}
                        class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 {timezone === tz ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100'}"
                      >
                        {tz}
                      </button>
                    {/each}
                  {:else}
                    <div class="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
                      {t('time.noTimezoneFound')}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          
          <div>
            <input
              id="date-input"
              type="text"
              bind:value={dateInput}
              placeholder="YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss"
              class="input"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              支持格式：YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss
            </p>
          </div>
          
          <div class="flex gap-2">
            <button onclick={clear} class="btn-secondary">
              {t('time.clear')}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- 结果显示卡片 -->
  {#if conversionType === 'timestamp' && timestampInput && dateResult}
    <div class="card">
      <div class="space-y-4">
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {t('time.date')}
          </h3>
        </div>
        
        <!-- YYYY-MM-DD HH:mm:ss 格式 -->
        <div>
          <div class="flex gap-2">
            <input
              type="text"
              readonly
              value={dateResult.spaceFormat}
              class="input font-mono text-sm flex-1"
            />
            <button
              onclick={() => copyToClipboard(dateResult.spaceFormat, 'date-space')}
              class="btn-secondary whitespace-nowrap {dateCopiedSpace ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
            >
              {#if dateCopiedSpace}
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
        </div>
        
        <!-- YYYY-MM-DDTHH:mm:ss 格式 -->
        <div>
          <div class="flex gap-2">
            <input
              type="text"
              readonly
              value={dateResult.isoFormat}
              class="input font-mono text-sm flex-1"
            />
            <button
              onclick={() => copyToClipboard(dateResult.isoFormat, 'date-iso')}
              class="btn-secondary whitespace-nowrap {dateCopiedIso ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
            >
              {#if dateCopiedIso}
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
        </div>
      </div>
    </div>
  {:else if conversionType === 'date' && dateInput && timestampResult}
    <div class="card">
      <div class="space-y-4">
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {t('time.timestamp')}
          </h3>
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            readonly
            value={timestampResult}
            class="input font-mono text-sm flex-1"
          />
          <button
            onclick={() => copyToClipboard(timestampResult, 'timestamp')}
            class="btn-secondary whitespace-nowrap {timestampCopied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
          >
            {#if timestampCopied}
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
      </div>
    </div>
  {/if}
</div>