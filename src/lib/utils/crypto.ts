/**
 * Simple encryption/decryption for API keys
 * Uses a combination of base64 and simple XOR for basic obfuscation
 * Note: This is not military-grade encryption, just to prevent casual snooping
 */

const STORAGE_KEY = 'kairoa.encryption.key';

function generateKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function getOrCreateKey(): string {
  if (typeof window === 'undefined') return generateKey();

  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = generateKey();
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}

function xorEncrypt(text: string, key: string): string {
  const textBytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(textBytes.length);

  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  return btoa(String.fromCharCode(...result));
}

function xorDecrypt(encrypted: string, key: string): string {
  try {
    const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const keyBytes = new TextEncoder().encode(key);
    const result = new Uint8Array(encryptedBytes.length);

    for (let i = 0; i < encryptedBytes.length; i++) {
      result[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return new TextDecoder().decode(result);
  } catch {
    return '';
  }
}

export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  const key = getOrCreateKey();
  return xorEncrypt(apiKey, key);
}

export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return '';
  const key = getOrCreateKey();
  return xorDecrypt(encrypted, key);
}

export function clearEncryptionKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
