import { translationsStore, type Translations } from '$lib/stores/i18n';
import { get } from 'svelte/store';
import { browser } from '$app/environment';

// 默认英文翻译，用于 SSR
const defaultTranslations: Translations = {
  app: {
    title: 'Kairoa',
    subtitle: 'Desktop Utility Tools'
  },
  nav: {
    hash: 'Hash Calculator',
    time: 'Time Converter',
    uuid: 'UUID Generator',
    json: 'JSON Formatter',
    base64: 'Base64 Encoder/Decoder',
    url: 'URL Encoder/Decoder'
  },
  hash: {
    title: 'Hash Calculator',
    input: 'Input Text',
    placeholder: 'Enter text to calculate hash...',
    calculate: 'Calculate',
    clear: 'Clear',
    algorithms: {
      md5: 'MD5',
      sha1: 'SHA-1',
      sha256: 'SHA-256',
      sha512: 'SHA-512'
    },
    result: 'Result'
  },
  time: {
    title: 'Time Converter',
    timestamp: 'Timestamp',
    date: 'Date',
    convert: 'Convert',
    clear: 'Clear'
  },
  uuid: {
    title: 'UUID Generator',
    generate: 'Generate',
    copy: 'Copy',
    generated: 'Generated UUIDs'
  },
  common: {
    copy: 'Copy',
    copied: 'Copied!',
    clear: 'Clear'
  }
};

export function useReactiveTranslations() {
  // 使用 derived store 创建响应式的翻译函数
  // 这将在组件中通过 $derived 使用
  return {
    translationsStore,
    getTranslation: (key: string, translations: Translations): string => {
      const keys = key.split('.');
      let value: any = translations;
      for (const k of keys) {
        value = value?.[k];
      }
      return value || key;
    },
    defaultTranslations
  };
}

