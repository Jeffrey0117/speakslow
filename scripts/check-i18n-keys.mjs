// 遞迴比對三個語系檔的 key 集合與佔位符是否一致
import zhTW from '../src/i18n/zh-TW.js';
import zhCN from '../src/i18n/zh-CN.js';
import en from '../src/i18n/en.js';

const collect = (obj, prefix = '', out = new Map()) => {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out.set(path, { type: 'array', length: v.length });
    } else if (v && typeof v === 'object') {
      collect(v, path, out);
    } else {
      const placeholders = [...String(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      out.set(path, { type: 'string', placeholders });
    }
  }
  return out;
};

const locales = { 'zh-TW': collect(zhTW), 'zh-CN': collect(zhCN), en: collect(en) };
const base = locales['zh-TW'];
let problems = 0;

for (const [name, map] of Object.entries(locales)) {
  if (name === 'zh-TW') continue;
  for (const key of base.keys()) {
    if (!map.has(key)) {
      console.log(`[MISSING] ${name} lacks key: ${key}`);
      problems++;
    }
  }
  for (const key of map.keys()) {
    if (!base.has(key)) {
      console.log(`[EXTRA] ${name} has extra key: ${key}`);
      problems++;
    }
  }
  for (const [key, info] of base.entries()) {
    const other = map.get(key);
    if (!other) continue;
    if (info.type !== other.type) {
      console.log(`[TYPE] ${key}: zh-TW=${info.type}, ${name}=${other.type}`);
      problems++;
    } else if (info.type === 'array' && info.length !== other.length) {
      console.log(`[ARRAY LEN] ${key}: zh-TW=${info.length}, ${name}=${other.length}`);
      problems++;
    } else if (
      info.type === 'string' &&
      JSON.stringify(info.placeholders) !== JSON.stringify(other.placeholders)
    ) {
      console.log(
        `[PLACEHOLDER] ${key}: zh-TW=[${info.placeholders}], ${name}=[${other.placeholders}]`
      );
      problems++;
    }
  }
}

if (problems === 0) {
  console.log(`OK: all 3 locales have identical key sets (${base.size} leaf keys), array lengths and placeholders.`);
} else {
  console.log(`FOUND ${problems} problem(s).`);
  process.exit(1);
}
