<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Search, Copy, Check, Trash2, Globe, MapPin, Server, Building, Calendar, Loader2 } from 'lucide-svelte';
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

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  interface IpInfo {
    ip: string;
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    timezone?: string;
    isp?: string;
    org?: string;
    asn?: string;
    latitude?: number;
    longitude?: number;
    postal?: string;
    hostname?: string;
  }

  let query = $state('');
  let isQuerying = $state(false);
  let result = $state<IpInfo | null>(null);
  let error = $state('');
  let copied = $state(false);
  const STORAGE_KEY = 'ipLookup.state.v1';
  let hasLoadedFromStorage = false;

  // 从本地存储恢复状态
  function loadSavedState() {
    if (!browser || hasLoadedFromStorage) return;
    hasLoadedFromStorage = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { query?: string };
        if (typeof parsed.query === 'string') query = parsed.query;
      }
    } catch (error) {
      console.error('Failed to load IP lookup state:', error);
    }
  }

  // 保存状态
  function saveState() {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ query }));
    } catch (error) {
      console.error('Failed to save IP lookup state:', error);
    }
  }

  // 初始化时加载保存的状态
  loadSavedState();

  // 查询变化时保存
  $effect(() => {
    query;
    saveState();
  });

  // 验证是否为有效的 IP 地址或域名
  function isValidInput(input: string): boolean {
    if (!input.trim()) return false;
    
    // 检查是否为 IP 地址（IPv4 或 IPv6）
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    // 检查是否为域名
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    
    return ipv4Regex.test(input) || ipv6Regex.test(input) || domainRegex.test(input);
  }

  async function lookup() {
    if (!query.trim()) {
      error = t('ipLookup.errors.queryRequired');
      return;
    }

    if (!isValidInput(query.trim())) {
      error = t('ipLookup.errors.invalidInput');
      return;
    }

    isQuerying = true;
    error = '';
    result = null;

    try {
      // 使用免费的 IP 查询 API (ip-api.com)
      // 注意：免费版本有速率限制，每分钟 45 次请求
      const input = query.trim();
      let apiUrl = '';
      
      // 如果是域名，先解析为 IP
      if (!input.match(/^(\d{1,3}\.){3}\d{1,3}$/) && !input.match(/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/)) {
        // 域名，需要先解析
        try {
          // 使用 DNS over HTTPS (Cloudflare) - 尝试 A 记录
          let dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(input)}&type=A`, {
            headers: {
              'Accept': 'application/dns-json'
            }
          });
          let dnsData = await dnsResponse.json();
          
          let ip = null;
          
          // 如果有 A 记录，使用第一个
          if (dnsData.Answer && dnsData.Answer.length > 0) {
            ip = dnsData.Answer.find((record: any) => record.type === 1)?.data;
          }
          
          // 如果没有 A 记录，尝试 AAAA (IPv6)
          if (!ip && dnsData.Answer && dnsData.Answer.length > 0) {
            ip = dnsData.Answer.find((record: any) => record.type === 28)?.data;
          }
          
          // 如果还是没有，尝试查询 AAAA
          if (!ip) {
            dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(input)}&type=AAAA`, {
              headers: {
                'Accept': 'application/dns-json'
              }
            });
            dnsData = await dnsResponse.json();
            if (dnsData.Answer && dnsData.Answer.length > 0) {
              ip = dnsData.Answer[0].data;
            }
          }
          
          if (!ip) {
            // 如果 DNS 查询失败，尝试直接使用域名查询（ip-api.com 支持域名）
            apiUrl = `http://ip-api.com/json/${input}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,query,hosting`;
          } else {
            apiUrl = `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,query,hosting`;
          }
        } catch (dnsError) {
          // DNS 解析失败时，尝试直接使用域名查询
          console.warn('DNS resolution failed, trying direct domain query:', dnsError);
          apiUrl = `http://ip-api.com/json/${input}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,query,hosting`;
        }
      } else {
        // 直接是 IP 地址
        apiUrl = `http://ip-api.com/json/${input}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,query,hosting`;
      }

      let data: any;
      
      // 在浏览器环境中，HTTP 请求可能被 CORS 阻止，优先使用 Tauri invoke
      // 如果在 Tauri 环境中，使用 invoke 绕过 CORS
      if (isTauriAvailable) {
        try {
          // 等待 Tauri API 加载
          if (!invokeFn) {
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 100));
              if (invokeFn) break;
            }
          }
          
          if (invokeFn) {
            const response = await invokeFn('http_request', {
              request: {
                url: apiUrl,
                method: 'GET',
                headers: {},
                body: null
              }
            }) as {
              status: number;
              headers: Record<string, string>;
              body: string;
              error: string | null;
            };
            
            if (response.error) {
              throw new Error(response.error);
            }
            
            data = JSON.parse(response.body);
          } else {
            throw new Error('Tauri API not available');
          }
        } catch (tauriError) {
          console.warn('Tauri request failed:', tauriError);
          error = t('ipLookup.errors.queryFailed') + ': ' + (tauriError instanceof Error ? tauriError.message : String(tauriError));
          isQuerying = false;
          return;
        }
      } else {
        // 浏览器环境，尝试使用 fetch（可能因 CORS 失败）
        try {
          const response = await fetch(apiUrl, {
            mode: 'cors',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          data = await response.json();
        } catch (fetchError) {
          // 如果 fetch 失败（通常是 CORS），提示用户
          error = t('ipLookup.errors.corsError') || 'CORS error: Please use the desktop app version for IP lookup, or try a different network environment.';
          isQuerying = false;
          return;
        }
      }

      if (data.status === 'fail') {
        error = data.message || t('ipLookup.errors.queryFailed');
        return;
      }

      // 转换 API 响应格式
      result = {
        ip: data.query || input,
        city: data.city || undefined,
        region: data.regionName || undefined,
        country: data.country || undefined,
        countryCode: data.countryCode || undefined,
        timezone: data.timezone || undefined,
        isp: data.isp || undefined,
        org: data.org || undefined,
        asn: data.as ? `${data.as} (${data.asname || ''})` : undefined,
        latitude: data.lat || undefined,
        longitude: data.lon || undefined,
        postal: data.zip || undefined,
        hostname: data.hosting ? undefined : (data.query ? await reverseDns(data.query) : undefined)
      };
    } catch (err) {
      error = err instanceof Error ? err.message : t('ipLookup.errors.queryFailed');
      console.error('IP lookup error:', err);
    } finally {
      isQuerying = false;
    }
  }

  // 反向 DNS 查询
  async function reverseDns(ip: string): Promise<string | undefined> {
    try {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(ip.split('.').reverse().join('.'))}.in-addr.arpa&type=PTR`, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });
      const data = await response.json();
      if (data.Answer && data.Answer.length > 0) {
        return data.Answer[0].data.replace(/\.$/, '');
      }
    } catch (err) {
      console.error('Reverse DNS lookup failed:', err);
    }
    return undefined;
  }

  function clear() {
    query = '';
    result = null;
    error = '';
  }

  async function copyResult() {
    if (!result) return;
    
    const text = JSON.stringify(result, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      lookup();
    }
  }
</script>

<div class="flex flex-col h-full w-full p-2">
  <div class="card flex-1 flex flex-col space-y-6">
    <div class="space-y-4">
      <!-- 查询输入 -->
      <div>
        <label for="query-input" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('ipLookup.query')}
        </label>
        <div class="flex gap-2">
          <input
            id="query-input"
            type="text"
            bind:value={query}
            placeholder={t('ipLookup.queryPlaceholder')}
            class="input flex-1"
            onkeydown={handleKeyPress}
            disabled={isQuerying}
          />
          <button
            onclick={lookup}
            class="btn-secondary"
            disabled={isQuerying || !query.trim()}
          >
            {#if isQuerying}
              <Loader2 class="w-4 h-4 inline mr-1 animate-spin" />
              {t('ipLookup.querying')}
            {:else}
              <Search class="w-4 h-4 inline mr-1" />
              {t('ipLookup.lookup')}
            {/if}
          </button>
          {#if query || result}
            <button type="button" class="btn-secondary" onclick={clear}>
              <Trash2 class="w-4 h-4 inline mr-1" />
              {t('ipLookup.clear')}
            </button>
          {/if}
          {#if result}
            <button
              onclick={copyResult}
              class="btn-secondary text-sm transition-all duration-200 {copied ? 'bg-green-500 hover:bg-green-600 text-white' : ''}"
            >
              {#if copied}
                <Check class="w-4 h-4 inline mr-1" />
                {t('common.copied')}
              {:else}
                <Copy class="w-4 h-4 inline mr-1" />
                {t('common.copy')}
              {/if}
            </button>
          {/if}
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('ipLookup.queryHint')}
        </p>
      </div>

      {#if error}
        <div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
          <p class="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      {/if}

      {#if result}
        <!-- 查询结果 -->
        <div class="space-y-4">
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Globe class="w-4 h-4" />
              {t('ipLookup.basicInfo')}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.ip')}</span>
                <p class="text-sm font-mono text-gray-900 dark:text-gray-100">{result.ip}</p>
              </div>
              {#if result.hostname}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.hostname')}</span>
                  <p class="text-sm font-mono text-gray-900 dark:text-gray-100">{result.hostname}</p>
                </div>
              {/if}
            </div>
          </div>

          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <MapPin class="w-4 h-4" />
              {t('ipLookup.location')}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              {#if result.country}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.country')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">
                    {result.country} {result.countryCode ? `(${result.countryCode})` : ''}
                  </p>
                </div>
              {/if}
              {#if result.region}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.region')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">{result.region}</p>
                </div>
              {/if}
              {#if result.city}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.city')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">{result.city}</p>
                </div>
              {/if}
              {#if result.postal}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.postal')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">{result.postal}</p>
                </div>
              {/if}
              {#if result.latitude !== undefined && result.longitude !== undefined}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.coordinates')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">
                    {result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}
                  </p>
                </div>
              {/if}
              {#if result.timezone}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.timezone')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">{result.timezone}</p>
                </div>
              {/if}
            </div>
          </div>

          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Server class="w-4 h-4" />
              {t('ipLookup.network')}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              {#if result.isp}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.isp')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">{result.isp}</p>
                </div>
              {/if}
              {#if result.org}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.org')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">{result.org}</p>
                </div>
              {/if}
              {#if result.asn}
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{t('ipLookup.asn')}</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100">{result.asn}</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {:else if !error && !isQuerying}
        <div class="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
          {t('ipLookup.empty')}
        </div>
      {/if}
    </div>
  </div>
</div>
