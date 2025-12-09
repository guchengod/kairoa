<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';

  type IbanResult = {
    normalized: string;
    formatted: string;
    countryCode: string;
    checkDigits: string;
    bban: string;
    expectedLength?: number;
    lengthValid: boolean;
    checksumValid: boolean;
    countrySupported: boolean;
    errors: string[];
    valid: boolean;
  };

  const countryLengths: Record<string, number> = {
    AL: 28, AD: 24, AT: 20, AZ: 28, BE: 16, BH: 22, BA: 20, BR: 29,
    BG: 22, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28, EE: 20,
    FO: 18, FI: 18, FR: 27, GE: 22, DE: 22, GI: 23, GR: 27, GL: 18,
    GT: 28, HU: 28, IS: 26, IE: 22, IL: 23, IT: 27, JO: 30, KZ: 20,
    KW: 30, LV: 21, LB: 28, LI: 21, LT: 20, LU: 20, MK: 19, MT: 31,
    MR: 27, MU: 30, MD: 24, MC: 27, ME: 22, NL: 18, NO: 15, PK: 24,
    PS: 29, PL: 28, PT: 25, QA: 29, RO: 24, SM: 27, SA: 24, RS: 22,
    SK: 24, SI: 19, ES: 24, SE: 24, CH: 21, TN: 24, TR: 26, UA: 29,
    AE: 23, GB: 22, VG: 24, XK: 20, LC: 32, SC: 31, ST: 25, BY: 28,
    SV: 28, TL: 23, VA: 22, BI: 16
  };

  const examples = [
    'DE89 3704 0044 0532 0130 00',
    'GB82 WEST 1234 5698 7654 32',
    'FR14 2004 1010 0505 0001 3M02 606',
    'ES91 2100 0418 4502 0005 1332'
  ];

  let translations = $derived($translationsStore);
  let ibanInput = $state('');
  let result = $state<IbanResult | null>(null);
  let copied = $state(false);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  function normalizeIban(input: string) {
    return input.replace(/\s+/g, '').toUpperCase();
  }

  function formatIban(iban: string) {
    return iban.replace(/(.{4})/g, '$1 ').trim();
  }

  function ibanToNumeric(iban: string) {
    return iban
      .split('')
      .map((ch) => {
        if (/[A-Z]/.test(ch)) {
          return (ch.charCodeAt(0) - 55).toString(); // A=10 ... Z=35
        }
        return ch;
      })
      .join('');
  }

  function mod97(numeric: string) {
    let remainder = 0;
    for (const ch of numeric) {
      remainder = (remainder * 10 + Number(ch)) % 97;
    }
    return remainder;
  }

  function validateIban() {
    const normalized = normalizeIban(ibanInput);
    const errors: string[] = [];

    if (!normalized) {
      errors.push(t('iban.errors.empty'));
      result = null;
      return;
    }

    const charValid = /^[A-Z0-9]+$/.test(normalized);
    if (!charValid) {
      errors.push(t('iban.errors.invalidChars'));
    }

    const countryCode = normalized.slice(0, 2);
    const checkDigits = normalized.slice(2, 4);
    const bban = normalized.slice(4);
    const expectedLength = countryLengths[countryCode];
    const countrySupported = Boolean(expectedLength);
    const lengthValid = expectedLength ? normalized.length === expectedLength : false;
    if (!countrySupported) {
      errors.push(t('iban.errors.unsupportedCountry'));
    } else if (!lengthValid) {
      errors.push(t('iban.errors.invalidLength').replace('{expected}', String(expectedLength)));
    }

    let checksumValid = false;
    if (charValid && normalized.length >= 4) {
      const rearranged = normalized.slice(4) + normalized.slice(0, 4);
      const numeric = ibanToNumeric(rearranged);
      checksumValid = mod97(numeric) === 1;
      if (!checksumValid) {
        errors.push(t('iban.errors.checksumFailed'));
      }
    }

    const valid = charValid && countrySupported && lengthValid && checksumValid;

    result = {
      normalized,
      formatted: formatIban(normalized),
      countryCode,
      checkDigits,
      bban,
      expectedLength,
      lengthValid,
      checksumValid,
      countrySupported,
      errors,
      valid
    };
  }

  function clear() {
    ibanInput = '';
    result = null;
    copied = false;
  }

  async function copyFormatted() {
    if (!result?.formatted) return;
    try {
      await navigator.clipboard.writeText(result.formatted);
      copied = true;
      setTimeout(() => (copied = false), 1000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  }
</script>

<div class="w-full ml-0 mr-0 p-2 space-y-6">
  <div class="card space-y-4">

    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('iban.input')}
      </label>
      <input
        class="input"
        type="text"
        bind:value={ibanInput}
        placeholder={t('iban.placeholder')}
        onkeydown={(e) => { if (e.key === 'Enter') validateIban(); }}
      />
      <div class="flex flex-wrap gap-2">
        {#each examples as ex}
          <button
            class="btn-secondary text-xs"
            onclick={() => { ibanInput = ex; validateIban(); }}
            type="button"
          >
            {ex}
          </button>
        {/each}
      </div>
    </div>

    <div class="flex gap-2">
      <button
        class="px-4 py-2 text-white rounded-lg transition-colors font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style="background-color: #5b7c99;"
        onclick={validateIban}
      >
        {t('iban.validate')}
      </button>
      <button class="btn-secondary" onclick={clear}>{t('common.clear')}</button>
    </div>
  </div>

  {#if result}
    <div class="card space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('iban.result')}</span>
          <span class="px-2 py-0.5 text-xs rounded-full {result.valid ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}">
            {result.valid ? t('iban.status.valid') : t('iban.status.invalid')}
          </span>
        </div>
        {#if result.formatted}
          <button
            class="btn-secondary text-sm {copied ? 'bg-green-500 text-white hover:bg-green-600' : ''}"
            onclick={copyFormatted}
          >
            {copied ? t('common.copied') : t('iban.copyFormatted')}
          </button>
        {/if}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.normalized')}</span>
            <span class="font-mono text-sm text-gray-900 dark:text-gray-100">{result.normalized}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.formatted')}</span>
            <span class="font-mono text-sm text-gray-900 dark:text-gray-100">{result.formatted}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.country')}</span>
            <span class="font-mono text-sm text-gray-900 dark:text-gray-100">
              {result.countryCode || t('iban.unknown')}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.checkDigits')}</span>
            <span class="font-mono text-sm text-gray-900 dark:text-gray-100">{result.checkDigits}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.bban')}</span>
            <span class="font-mono text-sm text-gray-900 dark:text-gray-100">{result.bban}</span>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.checksum')}</span>
            <span class="{result.checksumValid ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'} font-medium">
              {result.checksumValid ? t('iban.status.pass') : t('iban.status.fail')}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.length')}</span>
            <span class="{result.lengthValid ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'} font-medium">
              {result.lengthValid
                ? t('iban.status.pass')
                : (result.expectedLength
                  ? t('iban.lengthExpected').replace('{expected}', String(result.expectedLength))
                  : t('iban.status.unknown'))}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">{t('iban.countrySupport')}</span>
            <span class="{result.countrySupported ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'} font-medium">
              {result.countrySupported ? t('iban.status.pass') : t('iban.errors.unsupportedCountry')}
            </span>
          </div>
        </div>
      </div>

      {#if result.errors.length > 0}
        <div class="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 space-y-1">
          {#each result.errors as error}
            <div class="text-sm text-red-700 dark:text-red-200">• {error}</div>
          {/each}
        </div>
      {:else}
        <div class="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-200">
          {t('iban.validationPassed')}
        </div>
      {/if}

      <p class="text-xs text-gray-500 dark:text-gray-400">{t('iban.tip')}</p>
    </div>
  {/if}
</div>
