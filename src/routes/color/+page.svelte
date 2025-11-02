<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  
  type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla';
  
  let inputFormat = $state<ColorFormat>('hex');
  let outputFormat = $state<ColorFormat>('rgb');
  let inputValue = $state('');
  let outputValue = $state('');
  let previewColor = $state('');
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

  function getPlaceholder(format: ColorFormat): string {
    const placeholders = translations?.color?.placeholder;
    if (!placeholders) return '';
    return placeholders[format] || '';
  }

  // 解析 HEX 颜色
  function parseHex(hex: string): { r: number; g: number; b: number } | null {
    hex = hex.trim().replace('#', '');
    
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    if (hex.length !== 6) {
      return null;
    }
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }
    
    return { r, g, b };
  }

  // 解析 RGB/RGBA 颜色
  function parseRGB(rgb: string): { r: number; g: number; b: number; a?: number } | null {
    const match = rgb.match(/(\d+(?:\.\d+)?)/g);
    if (!match || match.length < 3) {
      return null;
    }
    
    const r = Math.round(parseFloat(match[0]));
    const g = Math.round(parseFloat(match[1]));
    const b = Math.round(parseFloat(match[2]));
    const a = match[3] !== undefined ? parseFloat(match[3]) : undefined;
    
    if (isNaN(r) || isNaN(g) || isNaN(b) || (a !== undefined && isNaN(a))) {
      return null;
    }
    
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      return null;
    }
    
    if (a !== undefined && (a < 0 || a > 1)) {
      return null;
    }
    
    return { r, g, b, a };
  }

  // 解析 HSL/HSLA 颜色
  function parseHSL(hsl: string): { h: number; s: number; l: number; a?: number } | null {
    const match = hsl.match(/(\d+(?:\.\d+)?)/g);
    if (!match || match.length < 3) {
      return null;
    }
    
    const h = parseFloat(match[0]);
    const s = parseFloat(match[1]);
    const l = parseFloat(match[2]);
    const a = match[3] !== undefined ? parseFloat(match[3]) : undefined;
    
    if (isNaN(h) || isNaN(s) || isNaN(l) || (a !== undefined && isNaN(a))) {
      return null;
    }
    
    if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) {
      return null;
    }
    
    if (a !== undefined && (a < 0 || a > 1)) {
      return null;
    }
    
    return { h, s, l, a };
  }

  // RGB 转 HEX
  function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  // RGB 转 HSL
  function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number, s: number, l: number;

    l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
        default: h = 0;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  // HSL 转 RGB
  function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;

    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  // 格式化为 HEX
  function formatHex(r: number, g: number, b: number): string {
    return rgbToHex(r, g, b);
  }

  // 格式化为 RGB
  function formatRGB(r: number, g: number, b: number, a?: number): string {
    if (a !== undefined) {
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  }

  // 格式化为 HSL
  function formatHSL(h: number, s: number, l: number, a?: number): string {
    if (a !== undefined) {
      return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  // 转换颜色
  function convertColor() {
    error = '';
    outputValue = '';
    previewColor = '';

    if (!inputValue.trim()) {
      return;
    }

    try {
      let rgb: { r: number; g: number; b: number; a?: number } | null = null;
      let hsl: { h: number; s: number; l: number; a?: number } | null = null;

      // 解析输入格式
      switch (inputFormat) {
        case 'hex':
          rgb = parseHex(inputValue);
          if (!rgb) {
            error = t('color.invalidHex');
            return;
          }
          break;
        case 'rgb':
        case 'rgba':
          rgb = parseRGB(inputValue);
          if (!rgb) {
            error = t('color.invalidRGB');
            return;
          }
          break;
        case 'hsl':
        case 'hsla':
          hsl = parseHSL(inputValue);
          if (!hsl) {
            error = t('color.invalidHSL');
            return;
          }
          if (hsl.a !== undefined) {
            rgb = { ...hslToRgb(hsl.h, hsl.s, hsl.l), a: hsl.a };
          } else {
            rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
          }
          break;
      }

      if (!rgb) {
        error = t('color.parseError');
        return;
      }

      // 转换为输出格式
      switch (outputFormat) {
        case 'hex':
          outputValue = formatHex(rgb.r, rgb.g, rgb.b);
          previewColor = outputValue;
          break;
        case 'rgb':
          outputValue = formatRGB(rgb.r, rgb.g, rgb.b);
          previewColor = formatRGB(rgb.r, rgb.g, rgb.b);
          break;
        case 'rgba':
          const alpha = rgb.a !== undefined ? rgb.a : 1;
          outputValue = formatRGB(rgb.r, rgb.g, rgb.b, alpha);
          previewColor = formatRGB(rgb.r, rgb.g, rgb.b, alpha);
          break;
        case 'hsl':
          hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          outputValue = formatHSL(hsl.h, hsl.s, hsl.l);
          previewColor = formatRGB(rgb.r, rgb.g, rgb.b);
          break;
        case 'hsla':
          hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          const hslAlpha = rgb.a !== undefined ? rgb.a : 1;
          outputValue = formatHSL(hsl.h, hsl.s, hsl.l, hslAlpha);
          previewColor = formatRGB(rgb.r, rgb.g, rgb.b, hslAlpha);
          break;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t('color.convertError');
    }
  }

  // 监听输入变化
  $effect(() => {
    convertColor();
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
    previewColor = '';
    error = '';
  }
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <div class="card flex-1 flex flex-col">
    <div class="flex-1 flex flex-col space-y-4">
      <!-- 格式选择 -->
      <div class="flex gap-4 items-center">
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('color.inputFormat')}
          </label>
          <select
            bind:value={inputFormat}
            class="input"
          >
            <option value="hex">HEX</option>
            <option value="rgb">RGB</option>
            <option value="rgba">RGBA</option>
            <option value="hsl">HSL</option>
            <option value="hsla">HSLA</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('color.outputFormat')}
          </label>
          <select
            bind:value={outputFormat}
            class="input"
          >
            <option value="hex">HEX</option>
            <option value="rgb">RGB</option>
            <option value="rgba">RGBA</option>
            <option value="hsl">HSL</option>
            <option value="hsla">HSLA</option>
          </select>
        </div>
      </div>

      <!-- 左右布局：输入 - 输出 -->
      <div class="flex-1 grid grid-cols-12 gap-4 items-stretch">
        <!-- 左侧输入区域 -->
        <div class="col-span-5 flex flex-col space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-base font-bold text-gray-700 dark:text-gray-300">
              {t('color.input')}
            </label>
          </div>
          <div class="relative flex-1">
            <textarea
              bind:value={inputValue}
              placeholder={getPlaceholder(inputFormat)}
              class="textarea h-full resize-none font-mono text-sm"
            ></textarea>
          </div>
        </div>

        <!-- 中间预览区域 -->
        <div class="col-span-2 flex flex-col justify-center items-center gap-3 px-2">
          {#if previewColor}
            <div 
              class="w-24 h-24 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-lg"
              style="background-color: {previewColor};"
            ></div>
          {:else}
            <div class="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
              <span class="text-xs text-gray-400 dark:text-gray-500">Preview</span>
            </div>
          {/if}
          <button onclick={clear} class="btn-secondary">
            {t('color.clear')}
          </button>
        </div>

        <!-- 右侧输出区域 -->
        <div class="col-span-5 flex flex-col space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-base font-bold text-gray-700 dark:text-gray-300">
              {t('color.output')}
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

