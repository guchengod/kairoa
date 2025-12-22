<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';

  type CoordinateSystem = 'WGS84' | 'GCJ02' | 'BD09' | 'WebMercator';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  let inputSystem = $state<CoordinateSystem>('WGS84');
  let outputSystem = $state<CoordinateSystem>('GCJ02');
  let inputLat = $state('');
  let inputLng = $state('');
  let outputLat = $state('');
  let outputLng = $state('');
  let error = $state('');
  let copied = $state(false);

  // WGS84 to GCJ02 (火星坐标系)
  function wgs84ToGcj02(wgsLat: number, wgsLng: number): [number, number] {
    const a = 6378245.0;
    const ee = 0.00669342162296594323;
    
    let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
    let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
    const radLat = (wgsLat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
    
    return [wgsLat + dLat, wgsLng + dLng];
  }

  // GCJ02 to WGS84
  function gcj02ToWgs84(gcjLat: number, gcjLng: number): [number, number] {
    let wgsLat = gcjLat;
    let wgsLng = gcjLng;
    
    // 迭代计算，通常3次迭代即可达到精度要求
    for (let i = 0; i < 3; i++) {
      const [deltaLat, deltaLng] = wgs84ToGcj02(wgsLat, wgsLng);
      wgsLat = gcjLat - (deltaLat - gcjLat);
      wgsLng = gcjLng - (deltaLng - gcjLng);
    }
    
    return [wgsLat, wgsLng];
  }

  // GCJ02 to BD09 (百度坐标系)
  function gcj02ToBd09(gcjLat: number, gcjLng: number): [number, number] {
    const z = Math.sqrt(gcjLng * gcjLng + gcjLat * gcjLat) + 0.00002 * Math.sin(gcjLat * Math.PI * 3000.0 / 180.0);
    const theta = Math.atan2(gcjLat, gcjLng) + 0.000003 * Math.cos(gcjLng * Math.PI * 3000.0 / 180.0);
    const bdLng = z * Math.cos(theta) + 0.0065;
    const bdLat = z * Math.sin(theta) + 0.006;
    return [bdLat, bdLng];
  }

  // BD09 to GCJ02
  function bd09ToGcj02(bdLat: number, bdLng: number): [number, number] {
    const x = bdLng - 0.0065;
    const y = bdLat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * Math.PI * 3000.0 / 180.0);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * Math.PI * 3000.0 / 180.0);
    const gcjLng = z * Math.cos(theta);
    const gcjLat = z * Math.sin(theta);
    return [gcjLat, gcjLng];
  }

  // WGS84 to Web Mercator
  function wgs84ToWebMercator(wgsLat: number, wgsLng: number): [number, number] {
    const x = wgsLng * 20037508.34 / 180.0;
    let y = Math.log(Math.tan((90.0 + wgsLat) * Math.PI / 360.0)) / (Math.PI / 180.0);
    y = y * 20037508.34 / 180.0;
    return [x, y];
  }

  // Web Mercator to WGS84
  function webMercatorToWgs84(x: number, y: number): [number, number] {
    const lng = x / 20037508.34 * 180.0;
    let lat = y / 20037508.34 * 180.0;
    lat = 180.0 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
    return [lat, lng];
  }

  function transformLat(lng: number, lat: number): number {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  function transformLng(lng: number, lat: number): number {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
  }

  function convertCoordinate() {
    error = '';
    outputLat = '';
    outputLng = '';

    if (!inputLat.trim() || !inputLng.trim()) {
      return;
    }

    const lat = parseFloat(inputLat.trim());
    const lng = parseFloat(inputLng.trim());

    if (isNaN(lat) || isNaN(lng)) {
      error = t('coordinateConverter.errors.invalidInput');
      return;
    }

    if (lat < -90 || lat > 90) {
      error = t('coordinateConverter.errors.invalidLatitude');
      return;
    }

    if (lng < -180 || lng > 180) {
      error = t('coordinateConverter.errors.invalidLongitude');
      return;
    }

    try {
      let result: [number, number] = [lat, lng];

      // 如果输入输出坐标系相同，直接返回
      if (inputSystem === outputSystem) {
        result = [lat, lng];
      } else {
        // 先转换为 WGS84（作为中间坐标系）
        let wgs84Lat = lat;
        let wgs84Lng = lng;

        if (inputSystem === 'GCJ02') {
          [wgs84Lat, wgs84Lng] = gcj02ToWgs84(lat, lng);
        } else if (inputSystem === 'BD09') {
          const [gcjLat, gcjLng] = bd09ToGcj02(lat, lng);
          [wgs84Lat, wgs84Lng] = gcj02ToWgs84(gcjLat, gcjLng);
        } else if (inputSystem === 'WebMercator') {
          [wgs84Lat, wgs84Lng] = webMercatorToWgs84(lat, lng);
        }

        // 从 WGS84 转换为目标坐标系
        if (outputSystem === 'WGS84') {
          result = [wgs84Lat, wgs84Lng];
        } else if (outputSystem === 'GCJ02') {
          result = wgs84ToGcj02(wgs84Lat, wgs84Lng);
        } else if (outputSystem === 'BD09') {
          const [gcjLat, gcjLng] = wgs84ToGcj02(wgs84Lat, wgs84Lng);
          result = gcj02ToBd09(gcjLat, gcjLng);
        } else if (outputSystem === 'WebMercator') {
          result = wgs84ToWebMercator(wgs84Lat, wgs84Lng);
        }
      }

      outputLat = result[0].toFixed(6);
      outputLng = result[1].toFixed(6);
    } catch (e) {
      error = e instanceof Error ? e.message : t('coordinateConverter.errors.convertError');
    }
  }

  function clear() {
    inputLat = '';
    inputLng = '';
    outputLat = '';
    outputLng = '';
    error = '';
  }

  async function copyResult() {
    if (!outputLat || !outputLng) return;
    
    const text = `${outputLat}, ${outputLng}`;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  $effect(() => {
    convertCoordinate();
  });
</script>

<div class="flex flex-col h-full w-full p-2">
  <div class="card flex-1 flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('coordinateConverter.title')}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('coordinateConverter.description')}</p>
      </div>
      {#if inputLat || inputLng}
        <button type="button" class="btn-secondary" onclick={clear}>
          {t('coordinateConverter.clear')}
        </button>
      {/if}
    </div>

    <div class="space-y-4">
      <!-- 坐标系选择 -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="input-system" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('coordinateConverter.inputSystem')}
          </label>
          <select id="input-system" bind:value={inputSystem} class="input">
            <option value="WGS84">WGS84 (GPS)</option>
            <option value="GCJ02">GCJ02 (火星坐标系)</option>
            <option value="BD09">BD09 (百度坐标系)</option>
            <option value="WebMercator">Web Mercator</option>
          </select>
        </div>
        <div>
          <label for="output-system" class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('coordinateConverter.outputSystem')}
          </label>
          <select id="output-system" bind:value={outputSystem} class="input">
            <option value="WGS84">WGS84 (GPS)</option>
            <option value="GCJ02">GCJ02 (火星坐标系)</option>
            <option value="BD09">BD09 (百度坐标系)</option>
            <option value="WebMercator">Web Mercator</option>
          </select>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="space-y-4">
        <div>
          <div class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('coordinateConverter.input')}
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="input-lat" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('coordinateConverter.latitude')}
              </label>
              <input
                id="input-lat"
                type="number"
                step="any"
                bind:value={inputLat}
                placeholder={t('coordinateConverter.latitudePlaceholder')}
                class="input w-full"
              />
            </div>
            <div>
              <label for="input-lng" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('coordinateConverter.longitude')}
              </label>
              <input
                id="input-lng"
                type="number"
                step="any"
                bind:value={inputLng}
                placeholder={t('coordinateConverter.longitudePlaceholder')}
                class="input w-full"
              />
            </div>
          </div>
        </div>

        <!-- 输出区域 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('coordinateConverter.output')}
            </div>
            {#if outputLat && outputLng}
              <button
                onclick={copyResult}
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
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="output-lat" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('coordinateConverter.latitude')}
              </label>
              <input
                id="output-lat"
                type="text"
                readonly
                value={outputLat}
                class="input w-full bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed font-mono"
              />
            </div>
            <div>
              <label for="output-lng" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('coordinateConverter.longitude')}
              </label>
              <input
                id="output-lng"
                type="text"
                readonly
                value={outputLng}
                class="input w-full bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {#if error}
        <div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
          <p class="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      {/if}

      <!-- 坐标系说明 -->
      <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
          {t('coordinateConverter.info.title')}
        </h3>
        <div class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
          <p><strong>WGS84:</strong> {t('coordinateConverter.info.wgs84')}</p>
          <p><strong>GCJ02:</strong> {t('coordinateConverter.info.gcj02')}</p>
          <p><strong>BD09:</strong> {t('coordinateConverter.info.bd09')}</p>
          <p><strong>Web Mercator:</strong> {t('coordinateConverter.info.webMercator')}</p>
        </div>
      </div>
    </div>
  </div>
</div>
