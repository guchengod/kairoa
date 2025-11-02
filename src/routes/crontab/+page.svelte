<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  let crontabExpression = $state('');
  let error = $state('');
  let nextRuns = $state<Date[]>([]);
  let description = $state('');

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // 解析 crontab 表达式的单个字段
  function parseField(field: string, min: number, max: number): number[] {
    if (field === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    }

    const result: number[] = [];
    const parts = field.split(',');

    for (const part of parts) {
      if (part.includes('/')) {
        // 处理步长，如 */5, 1-10/2
        const [range, stepStr] = part.split('/');
        const step = parseInt(stepStr, 10);
        
        if (range === '*') {
          for (let i = min; i <= max; i += step) {
            result.push(i);
          }
        } else if (range.includes('-')) {
          const [startStr, endStr] = range.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          for (let i = start; i <= end; i += step) {
            if (i >= min && i <= max) {
              result.push(i);
            }
          }
        }
      } else if (part.includes('-')) {
        // 处理范围，如 1-5
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        for (let i = start; i <= end; i++) {
          if (i >= min && i <= max) {
            result.push(i);
          }
        }
      } else {
        // 单个值
        const value = parseInt(part, 10);
        if (value >= min && value <= max) {
          result.push(value);
        }
      }
    }

    return [...new Set(result)].sort((a, b) => a - b);
  }

  // 解析 crontab 表达式
  function parseCrontab(expression: string): {
    minutes: number[];
    hours: number[];
    days: number[];
    months: number[];
    weekdays: number[];
  } | null {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return null;
    }

    try {
      const minutes = parseField(parts[0], 0, 59);
      const hours = parseField(parts[1], 0, 23);
      const days = parseField(parts[2], 1, 31);
      const months = parseField(parts[3], 1, 12);
      const weekdays = parseField(parts[4], 0, 6); // 0 = Sunday, 6 = Saturday

      return { minutes, hours, days, months, weekdays };
    } catch {
      return null;
    }
  }

  // 生成人类可读的描述
  function generateDescription(parsed: {
    minutes: number[];
    hours: number[];
    days: number[];
    months: number[];
    weekdays: number[];
  }): string {
    const parts: string[] = [];

    // 分钟
    if (parsed.minutes.length === 60) {
      parts.push(t('crontab.everyMinute'));
    } else if (parsed.minutes.length === 1) {
      parts.push(t('crontab.atMinute').replace('{minute}', parsed.minutes[0].toString()));
    } else {
      parts.push(t('crontab.atMinutes').replace('{minutes}', parsed.minutes.join(', ')));
    }

    // 小时
    if (parsed.hours.length === 24) {
      parts.push(t('crontab.everyHour'));
    } else if (parsed.hours.length === 1) {
      parts.push(t('crontab.atHour').replace('{hour}', parsed.hours[0].toString()));
    } else {
      parts.push(t('crontab.atHours').replace('{hours}', parsed.hours.join(', ')));
    }

    // 日期
    if (parsed.days.length === 31) {
      parts.push(t('crontab.everyDay'));
    } else if (parsed.days.length === 1) {
      parts.push(t('crontab.onDay').replace('{day}', parsed.days[0].toString()));
    } else {
      parts.push(t('crontab.onDays').replace('{days}', parsed.days.join(', ')));
    }

    // 月份
    if (parsed.months.length === 12) {
      parts.push(t('crontab.everyMonth'));
    } else if (parsed.months.length === 1) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      parts.push(t('crontab.inMonth').replace('{month}', monthNames[parsed.months[0] - 1]));
    } else {
      parts.push(t('crontab.inMonths'));
    }

    // 星期
    if (parsed.weekdays.length === 7) {
      // 每天都包括，不需要特别说明
    } else if (parsed.weekdays.length === 1) {
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      parts.push(t('crontab.onWeekday').replace('{weekday}', weekdayNames[parsed.weekdays[0]]));
    } else {
      parts.push(t('crontab.onWeekdays'));
    }

    return parts.join(' ');
  }

  // 计算下次执行时间
  function calculateNextRuns(parsed: {
    minutes: number[];
    hours: number[];
    days: number[];
    months: number[];
    weekdays: number[];
  }, count: number = 10): Date[] {
    const results: Date[] = [];
    const now = new Date();
    let current = new Date(now);
    current.setSeconds(0, 0);
    current.setMinutes(current.getMinutes() + 1); // 从下一分钟开始

    const maxAttempts = 100000; // 防止无限循环
    let attempts = 0;

    while (results.length < count && attempts < maxAttempts) {
      attempts++;

      // 检查月份
      if (!parsed.months.includes(current.getMonth() + 1)) {
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
        current.setHours(0, 0, 0, 0);
        continue;
      }

      // 检查日期和星期
      const dayOfMonth = current.getDate();
      const dayOfWeek = current.getDay();

      // Crontab 的日期和星期是 OR 关系：如果都指定了，满足任一即可
      // 如果一个是 *，则只检查另一个
      const dayMatch = parsed.days.includes(dayOfMonth);
      const weekdayMatch = parsed.weekdays.includes(dayOfWeek);

      // 如果日期和星期都是 *，则匹配所有
      // 如果一个是 *，检查另一个
      // 如果都指定了，满足任一即可
      let dayMatches = false;
      if (parsed.days.length === 31 && parsed.weekdays.length === 7) {
        // 都是 *，匹配所有
        dayMatches = true;
      } else if (parsed.days.length === 31) {
        // 日期是 *，只检查星期
        dayMatches = weekdayMatch;
      } else if (parsed.weekdays.length === 7) {
        // 星期是 *，只检查日期
        dayMatches = dayMatch;
      } else {
        // 都指定了，满足任一即可
        dayMatches = dayMatch || weekdayMatch;
      }

      if (!dayMatches) {
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        continue;
      }

      // 检查小时
      if (!parsed.hours.includes(current.getHours())) {
        current.setHours(current.getHours() + 1);
        current.setMinutes(0, 0, 0);
        continue;
      }

      // 检查分钟
      if (!parsed.minutes.includes(current.getMinutes())) {
        current.setMinutes(current.getMinutes() + 1);
        current.setSeconds(0, 0);
        continue;
      }

      // 找到了匹配的时间
      results.push(new Date(current));
      current.setMinutes(current.getMinutes() + 1);
      current.setSeconds(0, 0);
    }

    return results;
  }

  // 处理表达式变化
  function handleExpressionChange() {
    error = '';
    description = '';
    nextRuns = [];

    if (!crontabExpression.trim()) {
      return;
    }

    const parsed = parseCrontab(crontabExpression);
    if (!parsed) {
      error = t('crontab.invalidExpression');
      return;
    }

    try {
      description = generateDescription(parsed);
      nextRuns = calculateNextRuns(parsed);
    } catch (e) {
      error = e instanceof Error ? e.message : t('crontab.parseError');
    }
  }

  // 监听表达式变化
  $effect(() => {
    handleExpressionChange();
  });

  function clear() {
    crontabExpression = '';
    error = '';
    description = '';
    nextRuns = [];
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
</script>

<div class="w-full ml-0 mr-0 p-2 space-y-6">
  <!-- 输入区域卡片 -->
  <div class="card">
    <div class="space-y-4">
      <div>
        <label for="crontab-input" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('crontab.expression')}
        </label>
        <input
          id="crontab-input"
          type="text"
          bind:value={crontabExpression}
          placeholder={t('crontab.placeholder')}
          class="input font-mono text-sm"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('crontab.format')}
        </p>
      </div>

      {#if error}
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      {/if}

      {#if description}
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
            {t('crontab.description')}
          </p>
          <p class="text-sm text-blue-800 dark:text-blue-200">{description}</p>
        </div>
      {/if}

      <div class="flex gap-2">
        <button onclick={clear} class="btn-secondary">
          {t('crontab.clear')}
        </button>
      </div>
    </div>
  </div>

  <!-- 未来执行时间点卡片 -->
  {#if nextRuns.length > 0}
    <div class="card">
      <div class="space-y-4">
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('crontab.nextRuns')}
          </h3>
        </div>

        <div class="space-y-2">
          {#each nextRuns as run, index}
            <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p class="text-sm font-mono text-gray-900 dark:text-gray-100">
                {formatDate(run)}
              </p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

