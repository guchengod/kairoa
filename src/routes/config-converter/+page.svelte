<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Copy, Check, Trash2, ArrowLeftRight, FileCode, AlertCircle } from 'lucide-svelte';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  type Format = 'json' | 'yaml' | 'toml' | 'ini' | 'xml' | 'properties' | 'env' | 'toon';

  let inputFormat = $state<Format>('json');
  let outputFormat = $state<Format>('yaml');
  let inputText = $state('');
  let outputText = $state('');
  let error = $state('');
  const STORAGE_KEY = 'configConverter.state.v1';
  let hasLoadedFromStorage = false;

  // 从本地存储恢复状态
  function loadSavedState() {
    if (hasLoadedFromStorage) return;
    hasLoadedFromStorage = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        inputFormat = parsed.inputFormat || 'json';
        outputFormat = parsed.outputFormat || 'yaml';
        inputText = parsed.inputText || '';
      }
    } catch (error) {
      console.error('Failed to load config converter state:', error);
    }
  }

  // 保存状态
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        inputFormat,
        outputFormat,
        inputText
      }));
    } catch (error) {
      console.error('Failed to save config converter state:', error);
    }
  }

  // 初始化时加载保存的状态
  loadSavedState();

  // 状态变化时保存
  $effect(() => {
    inputFormat;
    outputFormat;
    inputText;
    saveState();
  });

  // 解析 JSON
  function parseJSON(text: string): any {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(t('configConverter.errors.invalidJson'));
    }
  }

  // 解析 YAML (简化实现)
  function parseYAML(text: string): any {
    const lines = text.split('\n');
    const result: any = {};
    let currentPath: string[] = [];
    let indentLevel = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.match(/^\s*/)?.[0].length || 0;
      const colonIndex = trimmed.indexOf(':');
      
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        
        // 调整路径
        const newIndent = Math.floor(indent / 2);
        if (newIndent < indentLevel) {
          currentPath = currentPath.slice(0, newIndent);
        }
        indentLevel = newIndent;

        if (value) {
          let target = result;
          for (const p of currentPath) {
            if (!target[p]) target[p] = {};
            target = target[p];
          }
          
          // 尝试解析值
          if (value === 'true') target[key] = true;
          else if (value === 'false') target[key] = false;
          else if (value === 'null') target[key] = null;
          else if (/^-?\d+$/.test(value)) target[key] = parseInt(value, 10);
          else if (/^-?\d*\.\d+$/.test(value)) target[key] = parseFloat(value);
          else if (value.startsWith('"') && value.endsWith('"')) {
            target[key] = value.slice(1, -1);
          } else {
            target[key] = value;
          }
        } else {
          currentPath = [...currentPath, key];
        }
      }
    }
    return result;
  }

  // 解析 TOML (简化实现)
  function parseTOML(text: string): any {
    const result: any = {};
    const lines = text.split('\n');
    let currentSection: any = result;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Section header [section]
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const sectionName = trimmed.slice(1, -1).trim();
        if (!result[sectionName]) result[sectionName] = {};
        currentSection = result[sectionName];
        continue;
      }

      // Key = value
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // 尝试解析值
        if (value === 'true') currentSection[key] = true;
        else if (value === 'false') currentSection[key] = false;
        else if (value === 'null') currentSection[key] = null;
        else if (/^-?\d+$/.test(value)) currentSection[key] = parseInt(value, 10);
        else if (/^-?\d*\.\d+$/.test(value)) currentSection[key] = parseFloat(value);
        else currentSection[key] = value;
      }
    }
    return result;
  }

  // 解析 INI
  function parseINI(text: string): any {
    const result: any = {};
    const lines = text.split('\n');
    let currentSection: any = result;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

      // Section header [section]
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const sectionName = trimmed.slice(1, -1).trim();
        if (!result[sectionName]) result[sectionName] = {};
        currentSection = result[sectionName];
        continue;
      }

      // Key = value
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        currentSection[key] = value;
      }
    }
    return result;
  }

  // 解析 XML
  function parseXML(text: string): any {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      
      if (doc.documentElement.nodeName === 'parsererror') {
        throw new Error(t('configConverter.errors.invalidXml'));
      }

      function xmlToObject(node: Node): any {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          return text || null;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const obj: any = {};
          
          // 处理属性
          if (element.attributes.length > 0) {
            obj['@attributes'] = {};
            for (let i = 0; i < element.attributes.length; i++) {
              const attr = element.attributes[i];
              obj['@attributes'][attr.name] = attr.value;
            }
          }

          // 处理子节点
          const children: any[] = [];
          for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.TEXT_NODE) {
              const childObj = xmlToObject(child);
              if (childObj !== null) {
                children.push(childObj);
              }
            }
          }

          if (children.length === 0) {
            return Object.keys(obj).length > 0 ? obj : null;
          } else if (children.length === 1 && typeof children[0] === 'string') {
            obj['@text'] = children[0];
            return obj;
          } else {
            // 合并同名节点
            const merged: any = {};
            for (const child of children) {
              if (typeof child === 'object' && child !== null) {
                for (const key in child) {
                  if (!merged[key]) {
                    merged[key] = child[key];
                  } else if (Array.isArray(merged[key])) {
                    merged[key].push(child[key]);
                  } else {
                    merged[key] = [merged[key], child[key]];
                  }
                }
              }
            }
            return { ...obj, ...merged };
          }
        }

        return null;
      }

      return xmlToObject(doc.documentElement);
    } catch (e: any) {
      throw new Error(e.message || t('configConverter.errors.invalidXml'));
    }
  }

  // 解析 Properties
  function parseProperties(text: string): any {
    const result: any = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        
        // 处理嵌套键 (key.subkey = value)
        const keys = key.split('.');
        let target = result;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!target[keys[i]]) target[keys[i]] = {};
          target = target[keys[i]];
        }
        target[keys[keys.length - 1]] = value;
      }
    }
    return result;
  }

  // 解析 ENV
  function parseENV(text: string): any {
    const result: any = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        result[key] = value;
      }
    }
    return result;
  }

  // 格式化 JSON
  function formatJSON(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }

  // 格式化 YAML (简化实现)
  function formatYAML(obj: any, indent = 0): string {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return obj.map(item => {
        const prefix = '  '.repeat(indent) + '- ';
        if (typeof item === 'object' && item !== null) {
          return prefix + formatYAML(item, indent + 1).replace(/^  /, '');
        }
        return prefix + formatYAML(item, indent);
      }).join('\n');
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) {
        // 空对象在 YAML 中应该返回空字符串（根级别）或 null（嵌套级别）
        return indent === 0 ? '' : 'null';
      }
      
      return entries.map(([key, value]) => {
        const prefix = '  '.repeat(indent);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const nestedValue = formatYAML(value, indent + 1);
          // 如果嵌套值是空对象，使用 null 或空字符串
          if (nestedValue === '' || nestedValue === 'null') {
            return `${prefix}${key}: null`;
          }
          return `${prefix}${key}:\n${nestedValue}`;
        }
        return `${prefix}${key}: ${formatYAML(value, indent)}`;
      }).join('\n');
    }

    return String(obj);
  }

  // 格式化 TOML
  function formatTOML(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
      return formatJSON(obj);
    }

    const lines: string[] = [];
    const sections: any = {};
    const root: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sections[key] = value;
      } else {
        root[key] = value;
      }
    }

    // Root level keys
    for (const [key, value] of Object.entries(root)) {
      lines.push(`${key} = ${formatTOMLValue(value)}`);
    }

    // Sections
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      if (lines.length > 0) lines.push('');
      lines.push(`[${sectionName}]`);
      if (typeof sectionData === 'object' && sectionData !== null) {
        for (const [key, value] of Object.entries(sectionData)) {
          lines.push(`${key} = ${formatTOMLValue(value)}`);
        }
      }
    }

    return lines.join('\n');
  }

  function formatTOMLValue(value: any): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      return '[' + value.map(formatTOMLValue).join(', ') + ']';
    }
    return String(value);
  }

  // 格式化 INI
  function formatINI(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
      return '';
    }

    const lines: string[] = [];
    const sections: any = {};
    const root: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sections[key] = value;
      } else {
        root[key] = value;
      }
    }

    // Root level keys
    for (const [key, value] of Object.entries(root)) {
      lines.push(`${key} = ${String(value)}`);
    }

    // Sections
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      if (lines.length > 0) lines.push('');
      lines.push(`[${sectionName}]`);
      if (typeof sectionData === 'object' && sectionData !== null) {
        for (const [key, value] of Object.entries(sectionData)) {
          lines.push(`${key} = ${String(value)}`);
        }
      }
    }

    return lines.join('\n');
  }

  // 格式化 XML
  function formatXML(obj: any, rootName = 'root'): string {
    function objectToXML(o: any, name: string, indent = 0): string {
      const prefix = '  '.repeat(indent);
      
      if (o === null || o === undefined) {
        return `${prefix}<${name} />`;
      }

      if (typeof o === 'string' || typeof o === 'number' || typeof o === 'boolean') {
        return `${prefix}<${name}>${String(o)}</${name}>`;
      }

      if (Array.isArray(o)) {
        return o.map(item => objectToXML(item, name, indent)).join('\n');
      }

      if (typeof o === 'object') {
        const attributes = o['@attributes'] || {};
        const text = o['@text'];
        const attrStr = Object.entries(attributes)
          .map(([k, v]) => ` ${k}="${String(v)}"`)
          .join('');

        if (text !== undefined) {
          return `${prefix}<${name}${attrStr}>${text}</${name}>`;
        }

        const children: string[] = [];
        for (const [key, value] of Object.entries(o)) {
          if (key !== '@attributes' && key !== '@text') {
            if (Array.isArray(value)) {
              children.push(...value.map(v => objectToXML(v, key, indent + 1)));
            } else {
              children.push(objectToXML(value, key, indent + 1));
            }
          }
        }

        if (children.length === 0) {
          return `${prefix}<${name}${attrStr} />`;
        }

        return `${prefix}<${name}${attrStr}>\n${children.join('\n')}\n${prefix}</${name}>`;
      }

      return `${prefix}<${name}>${String(o)}</${name}>`;
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + objectToXML(obj, rootName);
  }

  // 格式化 Properties
  function formatProperties(obj: any, prefix = ''): string {
    const lines: string[] = [];

    function flatten(o: any, path: string[]) {
      for (const [key, value] of Object.entries(o)) {
        const fullPath = [...path, key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, fullPath);
        } else {
          lines.push(`${fullPath.join('.')} = ${String(value)}`);
        }
      }
    }

    flatten(obj, []);
    return lines.join('\n');
  }

  // 格式化 ENV
  function formatENV(obj: any): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      lines.push(`${key}=${String(value)}`);
    }
    return lines.join('\n');
  }

  // 解析 TOON
  function parseTOON(text: string): any {
    const lines = text.split('\n');
    const result: any = {};
    let currentPath: string[] = [];
    let indentLevel = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      const indent = line.match(/^\s*/)?.[0].length || 0;
      const newIndent = Math.floor(indent / 2);
      
      // 调整路径
      if (newIndent < indentLevel) {
        currentPath = currentPath.slice(0, newIndent);
      }
      indentLevel = newIndent;

      // 检查是否是数组格式 key[length]: values 或 key[length]{fields}: rows
      const arrayMatch = trimmed.match(/^(\w+)\[(\d+)\](?:\{([^}]+)\})?:/);
      if (arrayMatch) {
        const [, key, lengthStr, fieldsStr] = arrayMatch;
        const length = parseInt(lengthStr, 10);
        const fields = fieldsStr ? fieldsStr.split(',').map(f => f.trim()) : null;
        
        let target = result;
        for (const p of currentPath) {
          if (!target[p]) target[p] = {};
          target = target[p];
        }

        if (fields) {
          // 表格数组格式
          const array: any[] = [];
          i++; // 跳过声明行
          for (let j = 0; j < length && i < lines.length; j++) {
            const rowLine = lines[i].trim();
            if (rowLine) {
              const values = rowLine.split(',').map(v => v.trim());
              const obj: any = {};
              for (let k = 0; k < fields.length && k < values.length; k++) {
                obj[fields[k]] = parseTOONValue(values[k]);
              }
              array.push(obj);
            }
            i++;
          }
          target[key] = array;
          continue;
        } else {
          // 简单数组格式
          const valuePart = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          const values = valuePart.split(',').map(v => v.trim());
          target[key] = values.map(parseTOONValue);
          i++;
          continue;
        }
      }

      // 普通键值对 key: value
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        
        let target = result;
        for (const p of currentPath) {
          if (!target[p]) target[p] = {};
          target = target[p];
        }

        if (value) {
          target[key] = parseTOONValue(value);
        } else {
          // 空值表示嵌套对象开始
          currentPath = [...currentPath, key];
        }
      }
      
      i++;
    }

    return result;
  }

  function parseTOONValue(value: string): any {
    value = value.trim();
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '') return null;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d*\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }

  // 格式化 TOON
  function formatTOON(obj: any, indent = 0, keyName?: string): string {
    if (obj === null || obj === undefined) return 'null';
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      
      const prefix = '  '.repeat(indent);
      
      // 检查是否是对象数组（表格格式）
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && !Array.isArray(obj[0])) {
        const firstObj = obj[0];
        const fields = Object.keys(firstObj);
        const lines: string[] = [];
        
        // 生成表头
        if (keyName) {
          lines.push(`${prefix}${keyName}[${obj.length}]{${fields.join(',')}}:`);
        } else {
          lines.push(`${prefix}[${obj.length}]{${fields.join(',')}}:`);
        }
        
        for (const item of obj) {
          const values = fields.map(field => {
            const val = item[field];
            if (val === null || val === undefined) return '';
            return String(val);
          });
          lines.push(`${prefix}  ${values.join(',')}`);
        }
        
        return lines.join('\n');
      } else {
        // 简单数组
        const values = obj.map(v => formatTOONValue(v)).join(',');
        if (keyName) {
          return `${prefix}${keyName}[${obj.length}]: ${values}`;
        }
        return `[${obj.length}]: ${values}`;
      }
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      
      const prefix = '  '.repeat(indent);
      const lines: string[] = [];
      
      for (const [key, value] of entries) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // 嵌套对象
          lines.push(`${prefix}${key}:`);
          lines.push(formatTOON(value, indent + 1));
        } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          // 对象数组（表格格式）
          const fields = Object.keys(value[0]);
          lines.push(`${prefix}${key}[${value.length}]{${fields.join(',')}}:`);
          for (const item of value) {
            const values = fields.map(field => {
              const val = item[field];
              if (val === null || val === undefined) return '';
              return String(val);
            });
            lines.push(`${prefix}  ${values.join(',')}`);
          }
        } else if (Array.isArray(value)) {
          // 简单数组
          if (value.length === 0) {
            lines.push(`${prefix}${key}: []`);
          } else {
            const values = value.map(v => formatTOONValue(v)).join(',');
            lines.push(`${prefix}${key}[${value.length}]: ${values}`);
          }
        } else {
          // 简单值
          lines.push(`${prefix}${key}: ${formatTOONValue(value)}`);
        }
      }
      
      return lines.join('\n');
    }

    return formatTOONValue(obj);
  }

  function formatTOONValue(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    return String(value);
  }

  // 解析输入
  function parseInput(format: Format, text: string): any {
    switch (format) {
      case 'json':
        return parseJSON(text);
      case 'yaml':
        return parseYAML(text);
      case 'toml':
        return parseTOML(text);
      case 'ini':
        return parseINI(text);
      case 'xml':
        return parseXML(text);
      case 'properties':
        return parseProperties(text);
      case 'env':
        return parseENV(text);
      case 'toon':
        return parseTOON(text);
      default:
        throw new Error(t('configConverter.errors.unsupportedFormat'));
    }
  }

  // 格式化输出
  function formatOutput(format: Format, obj: any): string {
    switch (format) {
      case 'json':
        return formatJSON(obj);
      case 'yaml':
        return formatYAML(obj);
      case 'toml':
        return formatTOML(obj);
      case 'ini':
        return formatINI(obj);
      case 'xml':
        return formatXML(obj);
      case 'properties':
        return formatProperties(obj);
      case 'env':
        return formatENV(obj);
      case 'toon':
        return formatTOON(obj);
      default:
        throw new Error(t('configConverter.errors.unsupportedFormat'));
    }
  }

  // 转换
  function convert() {
    error = '';
    outputText = '';
    outputCopied = false;

    if (!inputText.trim()) {
      error = t('configConverter.errors.emptyInput');
      return;
    }

    if (inputFormat === outputFormat) {
      error = t('configConverter.errors.sameFormat');
      return;
    }

    try {
      const parsed = parseInput(inputFormat, inputText);
      outputText = formatOutput(outputFormat, parsed);
    } catch (e: any) {
      error = e.message || t('configConverter.errors.conversionFailed');
    }
  }

  let inputCopied = $state(false);
  let outputCopied = $state(false);

  async function copyInput() {
    if (!inputText) return;
    
    try {
      await navigator.clipboard.writeText(inputText);
      inputCopied = true;
      setTimeout(() => {
        inputCopied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  async function copyOutput() {
    if (!outputText) return;
    
    try {
      await navigator.clipboard.writeText(outputText);
      outputCopied = true;
      setTimeout(() => {
        outputCopied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function clear() {
    inputText = '';
    outputText = '';
    error = '';
    inputCopied = false;
    outputCopied = false;
  }

  function swapFormats() {
    const temp = inputFormat;
    inputFormat = outputFormat;
    outputFormat = temp;
    const tempText = inputText;
    inputText = outputText;
    outputText = tempText;
    error = '';
  }

  // 输入变化时自动转换
  $effect(() => {
    if (inputText && inputFormat !== outputFormat) {
      convert();
    }
  });
</script>

<div class="flex flex-col h-full w-full p-2">
  <div class="card flex-1 flex flex-col space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 flex-1 min-h-0">
      <!-- 左侧：输入 -->
      <div class="flex flex-col space-y-4 min-h-0">
        <label for="input-format" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('configConverter.inputFormat')}
        </label>
        <select id="input-format" bind:value={inputFormat} class="input">
          <option value="json">JSON</option>
          <option value="yaml">YAML</option>
          <option value="toml">TOML</option>
          <option value="ini">INI</option>
          <option value="xml">XML</option>
          <option value="properties">Properties</option>
          <option value="env">ENV</option>
          <option value="toon">TOON</option>
        </select>
        <div class="flex flex-col flex-1 min-h-0">
          <div class="flex items-center justify-between mb-2">
            <label for="input-text" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('configConverter.input')}
            </label>
            {#if inputText}
              <button
                onclick={copyInput}
                class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 {inputCopied ? 'bg-green-500 hover:bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400'}"
                title={t('common.copy')}
              >
                {#if inputCopied}
                  <Check class="w-3.5 h-3.5" />
                {:else}
                  <Copy class="w-3.5 h-3.5" />
                {/if}
              </button>
            {/if}
          </div>
          <textarea
            id="input-text"
            bind:value={inputText}
            placeholder={t('configConverter.inputPlaceholder')}
            class="textarea font-mono text-sm flex-1 resize-none"
            style="ime-mode: disabled;"
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <!-- 中间：交换按钮和清空按钮 -->
      <div class="flex flex-col items-center justify-center self-center gap-2">
        <button
          onclick={swapFormats}
          class="btn-secondary text-sm flex items-center justify-center gap-1 w-full"
          title={t('configConverter.swapFormats')}
        >
          <ArrowLeftRight class="w-4 h-4" />
        </button>
        <button type="button" class="btn-secondary text-sm flex items-center justify-center gap-1 w-full" onclick={clear}>
          <Trash2 class="w-4 h-4" />
        </button>
      </div>

      <!-- 右侧：输出 -->
      <div class="flex flex-col space-y-4 min-h-0">
        <label for="output-format" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('configConverter.outputFormat')}
        </label>
        <select id="output-format" bind:value={outputFormat} class="input">
          <option value="json">JSON</option>
          <option value="yaml">YAML</option>
          <option value="toml">TOML</option>
          <option value="ini">INI</option>
          <option value="xml">XML</option>
          <option value="properties">Properties</option>
          <option value="env">ENV</option>
          <option value="toon">TOON</option>
        </select>
        <div class="flex flex-col flex-1 min-h-0">
          <div class="flex items-center justify-between mb-2">
            <label for="output-text" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('configConverter.output')}
            </label>
            {#if outputText}
              <button
                onclick={copyOutput}
                class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 {outputCopied ? 'bg-green-500 hover:bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400'}"
                title={t('common.copy')}
              >
                {#if outputCopied}
                  <Check class="w-3.5 h-3.5" />
                {:else}
                  <Copy class="w-3.5 h-3.5" />
                {/if}
              </button>
            {/if}
          </div>
          <textarea
            id="output-text"
            readonly
            bind:value={outputText}
            placeholder={t('configConverter.outputPlaceholder')}
            class="textarea font-mono text-sm flex-1 resize-none bg-gray-50 dark:bg-gray-900"
          ></textarea>
        </div>
      </div>
    </div>

    {#if error}
      <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <AlertCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <p class="text-sm text-red-800 dark:text-red-300">{error}</p>
      </div>
    {/if}
  </div>
</div>
