<script lang="ts">
  import * as convert from 'color-convert';
  import { translationsStore } from '$lib/stores/i18n';

  type ColorKey = 'hex' | 'rgb' | 'hsl' | 'hwb' | 'lch' | 'cmyk' | 'name';

  const defaultHex = '#1ea54c';

  let values = $state<Record<ColorKey, string>>({
    hex: defaultHex,
    rgb: '',
    hsl: '',
    hwb: '',
    lch: '',
    cmyk: '',
    name: ''
  });
  let error = $state('');
  let copiedKey = $state<ColorKey | null>(null);

  let translations = $derived($translationsStore);

  const rows: { key: ColorKey; label: () => string }[] = [
    { key: 'hex', label: () => t('color.labels.hex') },
    { key: 'rgb', label: () => t('color.labels.rgb') },
    { key: 'hsl', label: () => t('color.labels.hsl') },
    { key: 'hwb', label: () => t('color.labels.hwb') },
    { key: 'lch', label: () => t('color.labels.lch') },
    { key: 'cmyk', label: () => t('color.labels.cmyk') },
    { key: 'name', label: () => t('color.labels.name') }
  ];

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  function parseNumbers(value: string, expected: number): number[] | null {
    const matches = value.match(/-?\d+(?:\.\d+)?%?/g);
    if (!matches || matches.length < expected) return null;
    return matches.slice(0, expected).map((m) => parseFloat(m.replace('%', '')));
  }

  function parseHex(hex: string): { r: number; g: number; b: number } | null {
    if (!hex) return null;
    let normalized = hex.trim().replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map((c) => c + c).join('');
    }
    if (normalized.length !== 6) return null;

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }

  function parseRgb(input: string) {
    const nums = parseNumbers(input, 3);
    if (!nums) return null;
    const [r, g, b] = nums.map((n) => Math.round(n));
    if ([r, g, b].some((n) => n < 0 || n > 255)) return null;
    return { r, g, b };
  }

  function parseHsl(input: string) {
    const nums = parseNumbers(input, 3);
    if (!nums) return null;
    const [h, s, l] = nums;
    if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) return null;
    return { h, s, l };
  }

  function parseHwb(input: string) {
    const nums = parseNumbers(input, 3);
    if (!nums) return null;
    const [h, w, b] = nums;
    if (h < 0 || h > 360 || w < 0 || w > 100 || b < 0 || b > 100) return null;
    return { h, w, b };
  }

  function parseLch(input: string) {
    const nums = parseNumbers(input, 3);
    if (!nums) return null;
    const [l, c, h] = nums;
    if (l < 0 || l > 100 || c < 0) return null;
    return { l, c, h };
  }

  function parseCmyk(input: string) {
    const nums = parseNumbers(input, 4);
    if (!nums) return null;
    const [c, m, y, k] = nums;
    if ([c, m, y, k].some((n) => n < 0 || n > 100)) return null;
    return { c, m, y, k };
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const h = x.toString(16);
          return h.length === 1 ? `0${h}` : h;
        })
        .join('')
    );
  }

  function toFixed(value: number, digits = 2) {
    return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
  }

  function setFromRgb(r: number, g: number, b: number) {
    const [h, s, l] = convert.rgb.hsl([r, g, b]);
    const [hwbH, whiteness, blackness] = convert.rgb.hwb([r, g, b]);
    const [lVal, cVal, hVal] = convert.rgb.lch([r, g, b]);
    const [c, m, y, k] = convert.rgb.cmyk([r, g, b]);
    const keyword = convert.rgb.keyword([r, g, b]);

    values = {
      hex: rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`,
      hwb: `hwb(${Math.round(hwbH)} ${toFixed(whiteness)}% ${toFixed(blackness)}%)`,
      lch: `lch(${toFixed(lVal)}% ${toFixed(cVal)} ${toFixed(hVal)})`,
      cmyk: `device-cmyk(${toFixed(c)}% ${toFixed(m)}% ${toFixed(y)}% ${toFixed(k)}%)`,
      name: keyword ?? t('color.noName')
    };

    error = '';
  }

  function convertFrom(key: ColorKey, value: string) {
    values = { ...values, [key]: value };
    if (!value.trim()) {
      error = '';
      return;
    }

    try {
      switch (key) {
        case 'hex': {
          const rgb = parseHex(value);
          if (!rgb) throw new Error(t('color.invalidHex'));
          setFromRgb(rgb.r, rgb.g, rgb.b);
          break;
        }
        case 'rgb': {
          const rgb = parseRgb(value);
          if (!rgb) throw new Error(t('color.invalidRGB'));
          setFromRgb(rgb.r, rgb.g, rgb.b);
          break;
        }
        case 'hsl': {
          const hsl = parseHsl(value);
          if (!hsl) throw new Error(t('color.invalidHSL'));
          const [r, g, b] = convert.hsl.rgb([hsl.h, hsl.s, hsl.l]);
          setFromRgb(Math.round(r), Math.round(g), Math.round(b));
          break;
        }
        case 'hwb': {
          const hwb = parseHwb(value);
          if (!hwb) throw new Error(t('color.invalidHSL'));
          const [r, g, b] = convert.hwb.rgb([hwb.h, hwb.w, hwb.b]);
          setFromRgb(Math.round(r), Math.round(g), Math.round(b));
          break;
        }
        case 'lch': {
          const lch = parseLch(value);
          if (!lch) throw new Error(t('color.parseError'));
          const [r, g, b] = convert.lch.rgb([lch.l, lch.c, lch.h]);
          setFromRgb(Math.round(r), Math.round(g), Math.round(b));
          break;
        }
        case 'cmyk': {
          const cmyk = parseCmyk(value);
          if (!cmyk) throw new Error(t('color.parseError'));
          const [r, g, b] = convert.cmyk.rgb([cmyk.c, cmyk.m, cmyk.y, cmyk.k]);
          setFromRgb(Math.round(r), Math.round(g), Math.round(b));
          break;
        }
        case 'name': {
          const rgb = convert.keyword.rgb(value.trim());
          if (!rgb) throw new Error(t('color.parseError'));
          setFromRgb(rgb[0], rgb[1], rgb[2]);
          break;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t('color.convertError');
    }
  }

  function onHexChange(value: string) {
    convertFrom('hex', value.startsWith('#') ? value : `#${value}`);
  }

  function onPickerChange(value: string) {
    convertFrom('hex', value);
  }

  async function copyValue(key: ColorKey) {
    if (!values[key]) return;
    try {
      await navigator.clipboard.writeText(values[key]);
      copiedKey = key;
      // keep the value stable during async to avoid race with rapid edits
      const currentKey = key;
      setTimeout(() => {
        if (copiedKey === currentKey) copiedKey = null;
      }, 800);
    } catch (err) {
      console.error('Copy failed', err);
    }
  }

  function clearField(key: ColorKey) {
    values = { ...values, [key]: '' };
  }

  function resetAll() {
    convertFrom('hex', defaultHex);
  }

  // initialize once with default color
  convertFrom('hex', values.hex);
</script>

<div class="flex flex-col h-full w-full p-2">
  <div class="card flex-1 flex flex-col space-y-6">
    <div class="flex items-center gap-3">
      <div class="w-28 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('color.labels.colorPicker')}:
      </div>
      <div class="flex-1">
        <input
          type="color"
          class="h-10 w-full rounded-md border border-gray-300 dark:border-gray-700 cursor-pointer"
          bind:value={values.hex}
          oninput={(e) => onPickerChange((e.target as HTMLInputElement).value)}
          style={`background: ${values.hex};`}
        />
      </div>
    </div>

    <div class="space-y-2">
      {#each rows as row}
        <div class="flex items-center gap-3">
          <div class="w-28 text-right text-base font-medium text-gray-800 dark:text-gray-100">
            {row.label()}:
          </div>
          <input
            class="input flex-1 font-mono text-sm"
            bind:value={values[row.key]}
            oninput={(e) => convertFrom(row.key, (e.target as HTMLInputElement).value)}
          />
          <div class="flex items-center gap-2">
            <button class="btn-secondary px-3 py-2" onclick={() => copyValue(row.key)}>
              {copiedKey === row.key ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        </div>
      {/each}
    </div>

    {#if error}
      <div class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
        <p class="text-sm text-red-700 dark:text-red-200">{error}</p>
      </div>
    {/if}
  </div>
</div>
