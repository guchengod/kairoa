<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Search, Loader2, Server, Trash2 } from 'lucide-svelte';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  interface DnsRecord {
    name: string;
    type: number;
    ttl: number;
    data: string;
  }

  interface DnsRecordGroup {
    type: string;
    records: DnsRecord[];
  }

  const ALL_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV'];

  let domain = $state('');
  let selectedTypes = $state<string[]>(['A', 'AAAA']);
  let isQuerying = $state(false);
  let results = $state<DnsRecordGroup[]>([]);
  let error = $state('');

  function isValidDomain(input: string): boolean {
    if (!input.trim()) return false;
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(input.trim());
  }

  function toggleType(type: string) {
    if (selectedTypes.includes(type)) {
      selectedTypes = selectedTypes.filter((t) => t !== type);
    } else {
      selectedTypes = [...selectedTypes, type];
    }
  }

  function selectAllTypes() {
    selectedTypes = [...ALL_TYPES];
  }

  function clearTypes() {
    selectedTypes = [];
  }

  async function lookup() {
    const input = domain.trim();
    if (!input) {
      error = t('dnsLookup.errors.queryRequired');
      return;
    }
    if (!isValidDomain(input)) {
      error = t('dnsLookup.errors.invalidDomain');
      return;
    }

    // 如果未选择任何记录类型，默认查询 A 和 AAAA
    if (selectedTypes.length === 0) {
      selectedTypes = ['A', 'AAAA'];
    }

    isQuerying = true;
    error = '';
    results = [];

    try {
      const groups: DnsRecordGroup[] = [];

      await Promise.all(
        selectedTypes.map(async (type) => {
          try {
            const response = await fetch(
              `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(input)}&type=${encodeURIComponent(type)}`,
              {
                headers: {
                  Accept: 'application/dns-json',
                },
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const answers = Array.isArray(data.Answer) ? data.Answer : [];

            if (answers.length > 0) {
              const records: DnsRecord[] = answers.map((record: any) => ({
                name: record.name,
                type: record.type,
                ttl: record.TTL,
                data: String(record.data),
              }));

              groups.push({ type, records });
            }
          } catch (err) {
            console.error('DNS lookup failed for type', type, err);
          }
        })
      );

      // 按常见类型顺序排序结果
      const order = new Map(ALL_TYPES.map((t, index) => [t, index] as [string, number]));
      groups.sort((a, b) => (order.get(a.type) ?? 999) - (order.get(b.type) ?? 999));

      results = groups;

      if (groups.length === 0) {
        error = t('dnsLookup.noResults');
      }
    } catch (err) {
      console.error('DNS lookup error:', err);
      error = t('dnsLookup.errors.queryFailed');
    } finally {
      isQuerying = false;
    }
  }

  function clear() {
    domain = '';
    selectedTypes = ['A', 'AAAA'];
    results = [];
    error = '';
  }

  function getTypeBadgeClass(type: string) {
    if (selectedTypes.includes(type)) {
      return 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200 border-primary-300 dark:border-primary-700';
    }
    return 'bg-gray-50 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300 border-gray-200 dark:border-gray-700';
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2 space-y-4 overflow-y-auto">
  <div class="card">
    <div class="space-y-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('dnsLookup.title')}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dnsLookup.description')}</p>
      </div>

      <div class="space-y-4">
        <div>
          <label for="dns-domain-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('dnsLookup.query')}
          </label>
          <div class="flex gap-3">
            <div class="flex-1">
              <input
                id="dns-domain-input"
                type="text"
                bind:value={domain}
                placeholder={t('dnsLookup.queryPlaceholder')}
                class="input w-full"
                disabled={isQuerying}
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                onkeydown={(e) => e.key === 'Enter' && !isQuerying && lookup()}
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dnsLookup.queryHint')}</p>
            </div>
            <div class="flex items-start gap-2 pt-0">
              <button
                onclick={lookup}
                disabled={isQuerying || !domain.trim()}
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if isQuerying}
                  <Loader2 class="w-4 h-4 inline mr-2 animate-spin" />
                  {t('dnsLookup.querying')}
                {:else}
                  <Search class="w-4 h-4 inline mr-2" />
                  {t('dnsLookup.lookup')}
                {/if}
              </button>
              {#if domain || results.length > 0 || error}
                <button onclick={clear} class="btn-secondary">
                  <Trash2 class="w-4 h-4 inline mr-2" />
                  {t('ipLookup.clear')}
                </button>
              {/if}
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300" id="dns-record-types-label">
              {t('dnsLookup.recordTypes')}
            </label>
            <div class="flex items-center gap-2 text-xs" aria-labelledby="dns-record-types-label">
              <button type="button" class="btn-ghost px-2 py-1 h-7" onclick={selectAllTypes}>
                {t('dnsLookup.selectAll')}
              </button>
              <button type="button" class="btn-ghost px-2 py-1 h-7" onclick={clearTypes}>
                {t('dnsLookup.clearSelection')}
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2" aria-labelledby="dns-record-types-label">
            {#each ALL_TYPES as type}
              <button
                type="button"
                class={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${getTypeBadgeClass(type)}`}
                onclick={() => toggleType(type)}
              >
                {type}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if error}
    <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
      <Server class="w-5 h-5 text-red-600 dark:text-red-300 mt-0.5 flex-shrink-0" />
      <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
    </div>
  {/if}

  {#if results.length > 0}
    <div class="space-y-4">
      {#each results as group}
        <div class="card">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Server class="w-4 h-4 text-primary-500" />
              <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{group.type} {t('dnsLookup.results')}</h2>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{group.records.length} records</span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                  <th class="text-left py-2 pr-4 font-medium">{t('dnsLookup.type')}</th>
                  <th class="text-left py-2 pr-4 font-medium">{t('dnsLookup.ttl')}</th>
                  <th class="text-left py-2 pr-4 font-medium">{t('dnsLookup.data')}</th>
                </tr>
              </thead>
              <tbody>
                {#each group.records as record}
                  <tr class="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                    <td class="py-2 pr-4 align-top font-mono text-xs text-gray-900 dark:text-gray-100">{group.type}</td>
                    <td class="py-2 pr-4 align-top font-mono text-xs text-gray-700 dark:text-gray-300">{record.ttl}</td>
                    <td class="py-2 pr-4 align-top font-mono text-xs text-gray-900 dark:text-gray-100 break-all">{record.data}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
