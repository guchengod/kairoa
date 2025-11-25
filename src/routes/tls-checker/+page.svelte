<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { browser } from '$app/environment';
  import { invoke } from '@tauri-apps/api/core';
  import { Search, CheckCircle, XCircle, AlertCircle, Loader2, Shield } from 'lucide-svelte';

  let translations = $derived($translationsStore);

  function t(key: string): any {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value ?? key;
  }

  interface TlsVersionInfo {
    version: string;
    supported: boolean;
    error?: string | null;
  }

  interface CipherSuiteInfo {
    name: string;
    supported: boolean;
    error?: string | null;
    tls_version: string;
    security_level: string;
  }

  interface TlsCheckResponse {
    host: string;
    port: number;
    supported_versions: TlsVersionInfo[];
    preferred_version?: string | null;
    certificate_info?: {
      subject: string;
      issuer: string;
      valid_from: string;
      valid_to: string;
      serial_number: string;
    } | null;
    cipher_suites: CipherSuiteInfo[];
  }

  let host = $state('');
  let isChecking = $state(false);
  let result = $state<TlsCheckResponse | null>(null);
  let error = $state('');

  async function checkTls() {
    if (!host.trim()) {
      error = t('tlsChecker.errors.hostRequired');
      return;
    }

    isChecking = true;
    error = '';
    result = null;

    try {
      const response = await invoke<TlsCheckResponse>('check_tls_versions', {
        request: {
          host: host.trim(),
          port: null // Always use default 443
        }
      });
      result = response;
    } catch (err) {
      error = `${t('tlsChecker.errors.checkFailed')}: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      isChecking = false;
    }
  }

  function clear() {
    host = '';
    result = null;
    error = '';
  }

  function getVersionStatusClass(version: TlsVersionInfo) {
    if (version.supported) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
    }
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
  }

  function getCipherSuiteStatusClass(cipher: CipherSuiteInfo) {
    if (cipher.supported) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
    }
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
  }

  function getSecurityLevelClass(level: string) {
    switch (level) {
      case 'secure':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
      case 'weak':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
      case 'insecure':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
    }
  }

  function groupCipherSuitesByVersion(cipherSuites: CipherSuiteInfo[]) {
    const grouped: Record<string, CipherSuiteInfo[]> = {};
    for (const cipher of cipherSuites) {
      if (!grouped[cipher.tls_version]) {
        grouped[cipher.tls_version] = [];
      }
      grouped[cipher.tls_version].push(cipher);
    }
    // Sort cipher suites within each version by security level (secure first)
    const securityOrder: Record<string, number> = {
      secure: 0,
      moderate: 1,
      weak: 2,
      insecure: 3
    };
    for (const version in grouped) {
      grouped[version].sort((a, b) => {
        const aOrder = securityOrder[a.security_level] ?? 99;
        const bOrder = securityOrder[b.security_level] ?? 99;
        return aOrder - bOrder;
      });
    }
    return grouped;
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2 space-y-4 overflow-y-auto">
  <div class="card">
    <div class="space-y-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('tlsChecker.title')}</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('tlsChecker.description')}</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('tlsChecker.host')}
        </label>
        <div class="flex gap-3">
          <div class="flex-1">
            <input
              type="text"
              bind:value={host}
              placeholder={t('tlsChecker.hostPlaceholder')}
              class="input w-full"
              disabled={isChecking}
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              onkeydown={(e) => e.key === 'Enter' && !isChecking && checkTls()}
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('tlsChecker.portHint')}</p>
          </div>
          <div class="flex items-start gap-2 pt-0">
            <button
              onclick={checkTls}
              disabled={isChecking || !host.trim()}
              class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isChecking}
                <Loader2 class="w-4 h-4 inline mr-2 animate-spin" />
                {t('tlsChecker.checking')}
              {:else}
                <Search class="w-4 h-4 inline mr-2" />
                {t('tlsChecker.check')}
              {/if}
            </button>
            {#if result || error}
              <button onclick={clear} class="btn-secondary">
                {t('tlsChecker.clear')}
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if error}
    <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
      <XCircle class="w-5 h-5 text-red-600 dark:text-red-300 mt-0.5 flex-shrink-0" />
      <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
    </div>
  {/if}

  {#if result}
    <div class="space-y-4">
      <div class="card">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('tlsChecker.results')}</h2>
            <Shield class="w-5 h-5 text-primary-500" />
          </div>
          <div class="text-sm text-gray-700 dark:text-gray-300">
            <p><span class="font-medium">{t('tlsChecker.target')}:</span> {result.host}:{result.port}</p>
            {#if result.preferred_version}
              <p class="mt-1">
                <span class="font-medium">{t('tlsChecker.preferredVersion')}:</span>
                <span class="text-green-600 dark:text-green-400 font-semibold ml-2">{result.preferred_version}</span>
              </p>
            {/if}
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('tlsChecker.supportedVersions')}</h3>
        <div class="space-y-2">
          {#each result.supported_versions as version}
            <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-3">
                {#if version.supported}
                  <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400" />
                {:else}
                  <XCircle class="w-5 h-5 text-red-600 dark:text-red-400" />
                {/if}
                <span class="font-medium text-gray-900 dark:text-gray-100">{version.version}</span>
              </div>
              <span class="px-3 py-1 text-xs font-semibold rounded-full {getVersionStatusClass(version)}">
                {version.supported ? t('tlsChecker.supported') : t('tlsChecker.notSupported')}
              </span>
            </div>
            {#if version.error}
              <p class="text-xs text-red-600 dark:text-red-400 ml-8">{version.error}</p>
            {/if}
          {/each}
        </div>
      </div>

      {#if result.cipher_suites && result.cipher_suites.length > 0}
        {@const grouped = groupCipherSuitesByVersion(result.cipher_suites)}
        {@const sortedVersions = Object.keys(grouped).sort((a, b) => {
          // Sort versions: TLSv1.3 first, then TLSv1.2, etc.
          if (a === 'TLSv1.3' && b !== 'TLSv1.3') return -1;
          if (a !== 'TLSv1.3' && b === 'TLSv1.3') return 1;
          return b.localeCompare(a); // Higher version first
        })}
        <div class="card">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('tlsChecker.cipherSuites')}</h3>
          <div class="space-y-4 max-h-96 overflow-y-auto">
            {#each sortedVersions as version}
              {@const ciphers = grouped[version]}
              <div class="space-y-2">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Shield class="w-4 h-4" />
                  {version}
                </h4>
                <div class="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  {#each ciphers as cipher}
                    <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div class="flex items-center gap-3 flex-1 min-w-0">
                        {#if cipher.supported}
                          <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        {:else}
                          <XCircle class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        {/if}
                        <span class="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">{cipher.name}</span>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full {getSecurityLevelClass(cipher.security_level)}">
                          {t(`tlsChecker.security.${cipher.security_level}`)}
                        </span>
                        <span class="px-3 py-1 text-xs font-semibold rounded-full {getCipherSuiteStatusClass(cipher)}">
                          {cipher.supported ? t('tlsChecker.supported') : t('tlsChecker.notSupported')}
                        </span>
                      </div>
                    </div>
                    {#if cipher.error}
                      <p class="text-xs text-red-600 dark:text-red-400 ml-8">{cipher.error}</p>
                    {/if}
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if result.certificate_info}
        <div class="card">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Shield class="w-4 h-4 text-primary-500" />
            {t('tlsChecker.certificateInfo')}
          </h3>
          <div class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p><span class="font-medium">{t('tlsChecker.certificateSubject')}:</span> {result.certificate_info.subject}</p>
            <p><span class="font-medium">{t('tlsChecker.certificateIssuer')}:</span> {result.certificate_info.issuer}</p>
            <p><span class="font-medium">{t('tlsChecker.certificateValidFrom')}:</span> {result.certificate_info.valid_from}</p>
            <p><span class="font-medium">{t('tlsChecker.certificateValidTo')}:</span> {result.certificate_info.valid_to}</p>
            <p><span class="font-medium">{t('tlsChecker.certificateSerial')}:</span> {result.certificate_info.serial_number}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

