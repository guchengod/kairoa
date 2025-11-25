<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { invoke } from '@tauri-apps/api/core';
  import { Search, Loader2, Radio, Activity } from 'lucide-svelte';

  let translations = $derived($translationsStore);

  function t(key: string): any {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value ?? key;
  }

  interface PortScanResult {
    port: number;
    status: string;
    latency_ms?: number | null;
  }

  interface PortScanResponse {
    host: string;
    start_port: number;
    end_port: number;
    scanned_ports: number;
    duration_ms: number;
    open_ports: PortScanResult[];
  }

  let host = $state('');
  let startPort = $state(1);
  let endPort = $state(1024);
  let timeout = $state(700);
  let concurrency = $state(200);
  let isScanning = $state(false);
  let result = $state<PortScanResponse | null>(null);
  let error = $state('');

  const quickRanges = [
    { label: 'Top 100 (1-100)', start: 1, end: 100 },
    { label: 'Common (1-1024)', start: 1, end: 1024 },
    { label: 'Extended (1-2048)', start: 1, end: 2048 },
    { label: 'All (1-65535)', start: 1, end: 65535 }
  ];

  function applyRange(range: { start: number; end: number }) {
    startPort = range.start;
    endPort = range.end;
    
    // Auto-adjust timeout and concurrency for large ranges
    const portCount = endPort - startPort + 1;
    if (portCount > 10000) {
      // Large range: increase concurrency, reduce timeout
      timeout = 300;
      concurrency = 500;
    } else if (portCount > 2048) {
      // Medium range: moderate settings
      timeout = 500;
      concurrency = 300;
    } else {
      // Small range: default settings
      timeout = 700;
      concurrency = 200;
    }
  }

  async function scan() {
    if (!host.trim()) {
      error = t('portScanner.errors.hostRequired');
      return;
    }
    if (startPort < 1 || endPort > 65535 || startPort > endPort) {
      error = t('portScanner.errors.invalidRange');
      return;
    }

    // Auto-adjust timeout and concurrency based on port range
    const portCount = endPort - startPort + 1;
    let adjustedTimeout = timeout;
    let adjustedConcurrency = concurrency;
    
    if (portCount > 10000) {
      // Large range: optimize for speed
      adjustedTimeout = Math.min(timeout, 300);
      adjustedConcurrency = Math.max(concurrency, 500);
    } else if (portCount > 2048) {
      // Medium range: moderate optimization
      adjustedTimeout = Math.min(timeout, 500);
      adjustedConcurrency = Math.max(concurrency, 300);
    }

    isScanning = true;
    error = '';
    result = null;

    try {
      const response = await invoke<PortScanResponse>('scan_ports', {
        request: {
          host: host.trim(),
          start_port: startPort,
          end_port: endPort,
          timeout_ms: adjustedTimeout,
          max_concurrency: adjustedConcurrency
        }
      });
      result = response;
    } catch (err) {
      error = `${t('portScanner.errors.scanFailed')}: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      isScanning = false;
    }
  }

  function clear() {
    host = '';
    startPort = 1;
    endPort = 1024;
    timeout = 700;
    concurrency = 200;
    result = null;
    error = '';
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2 space-y-4 overflow-y-auto">
  <div class="card space-y-4">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('portScanner.title')}</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('portScanner.description')}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('portScanner.host')}
        </label>
        <input
          type="text"
          bind:value={host}
          placeholder={t('portScanner.hostPlaceholder')}
          class="input w-full"
          disabled={isScanning}
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          onkeydown={(e) => e.key === 'Enter' && !isScanning && scan()}
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('portScanner.startPort')}
          </label>
          <input
            type="number"
            min="1"
            max="65535"
            bind:value={startPort}
            class="input w-full"
            disabled={isScanning}
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('portScanner.endPort')}
          </label>
          <input
            type="number"
            min="1"
            max="65535"
            bind:value={endPort}
            class="input w-full"
            disabled={isScanning}
          />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('portScanner.timeout')}
        </label>
        <input
          type="number"
          min="50"
          max="10000"
          step="50"
          bind:value={timeout}
          class="input w-full"
          disabled={isScanning}
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('portScanner.concurrency')}
        </label>
        <input
          type="number"
          min="1"
          max="1000"
          bind:value={concurrency}
          class="input w-full"
          disabled={isScanning}
        />
      </div>
    </div>

    <div>
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('portScanner.quickRanges')}</p>
      <div class="flex flex-wrap gap-2">
        {#each quickRanges as range}
          <button
            class="btn-secondary text-sm"
            type="button"
            disabled={isScanning}
            onclick={() => applyRange(range)}
          >
            {range.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="flex flex-col md:flex-row gap-3">
      <button
        class="btn-primary flex-1"
        onclick={scan}
        disabled={isScanning || !host.trim()}
      >
        {#if isScanning}
          <Loader2 class="w-4 h-4 inline mr-2 animate-spin" />
          {t('portScanner.scanning')}
        {:else}
          <Search class="w-4 h-4 inline mr-2" />
          {t('portScanner.scan')}
        {/if}
      </button>
      <button class="btn-secondary md:w-40" onclick={clear} disabled={isScanning}>
        {t('portScanner.clear')}
      </button>
    </div>
  </div>

  {#if error}
    <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
      <Radio class="w-5 h-5 text-red-600 dark:text-red-300 mt-0.5 flex-shrink-0" />
      <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
    </div>
  {/if}

  {#if result}
    <div class="space-y-4">
      <div class="card">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('portScanner.summary')}</h2>
            <Activity class="w-5 h-5 text-primary-500" />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <p class="font-medium">{t('portScanner.host')}:</p>
              <p class="mt-1 break-all">{result.host}</p>
            </div>
            <div>
              <p class="font-medium">{t('portScanner.scannedPorts')}:</p>
              <p class="mt-1">{result.scanned_ports}</p>
            </div>
            <div>
              <p class="font-medium">{t('portScanner.duration')}:</p>
              <p class="mt-1">{result.duration_ms} ms</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('portScanner.openPorts')}</h3>
        {#if result.open_ports.length === 0}
          <p class="text-sm text-gray-600 dark:text-gray-400">{t('portScanner.noResults')}</p>
        {:else}
          <div class="space-y-2 max-h-96 overflow-y-auto">
            {#each [...result.open_ports].sort((a, b) => a.port - b.port) as port}
              <div class="flex items-center justify-between p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <div>
                  <p class="font-mono text-sm text-gray-900 dark:text-gray-100">:{port.port}</p>
                  {#if port.latency_ms}
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{port.latency_ms.toFixed(1)} ms</p>
                  {/if}
                </div>
                <span class="px-3 py-1 text-xs font-semibold rounded-full bg-green-600 text-white">
                  {t('portScanner.statusOpen')}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

