import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import * as OpenCC from 'opencc-js';
import zhCN from './zh-CN';
import zhTW from './zh-TW';
import en from './en';

// 翻译资源
const resources = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en': en
};

// 创建简体转繁体转换器
const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });

// 创建繁体转简体转换器
const t2sConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });

// 语言上下文
const LanguageContext = createContext(null);

// 获取嵌套对象的值
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
};

// 翻译函数
const translate = (key, lang, params = {}) => {
  const translation = getNestedValue(resources[lang], key);

  if (translation === null) {
    console.warn(`Translation missing for key: ${key} in language: ${lang}`);
    return key;
  }

  // 替换参数 {param}
  let result = translation;
  Object.keys(params).forEach(param => {
    result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });

  return result;
};

// 简繁转换函数
export const convertText = (text, targetLang) => {
  if (!text) return text;

  if (targetLang === 'zh-TW') {
    return s2tConverter(text);
  } else if (targetLang === 'zh-CN') {
    return t2sConverter(text);
  }

  // 其他语言（如 'en'）不做简繁转换，直接返回原文
  return text;
};

// useTranslation Hook
export const useTranslation = () => {
  const context = useContext(LanguageContext);
  const [language, setLanguageState] = useState('zh-TW'); // 默认繁体中文

  useEffect(() => {
    // 从设置加载语言
    const loadLanguage = async () => {
      if (window.electronAPI) {
        const savedLang = await window.electronAPI.getSetting('language', 'zh-TW');
        setLanguageState(savedLang);
      }
    };
    loadLanguage();

    // 监听语言变化
    const handleLanguageChange = async () => {
      if (window.electronAPI) {
        const newLang = await window.electronAPI.getSetting('language', 'zh-TW');
        setLanguageState(newLang);
      }
    };

    window.addEventListener('language-changed', handleLanguageChange);
    return () => window.removeEventListener('language-changed', handleLanguageChange);
  }, []);

  const t = useCallback((key, params = {}) => {
    return translate(key, context?.language || language, params);
  }, [context?.language, language]);

  const setLanguage = useCallback(async (newLang) => {
    if (window.electronAPI) {
      await window.electronAPI.setSetting('language', newLang);
      setLanguageState(newLang);
      window.dispatchEvent(new Event('language-changed'));
    } else {
      setLanguageState(newLang);
    }
  }, []);

  const convert = useCallback((text) => {
    return convertText(text, context?.language || language);
  }, [context?.language, language]);

  return {
    t,
    language: context?.language || language,
    setLanguage,
    convert,
    languages: Object.keys(resources)
  };
};

// LanguageProvider 组件
export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('zh-TW');

  useEffect(() => {
    const loadLanguage = async () => {
      if (window.electronAPI) {
        const savedLang = await window.electronAPI.getSetting('language', 'zh-TW');
        setLanguage(savedLang);
      }
    };
    loadLanguage();

    const handleLanguageChange = async () => {
      if (window.electronAPI) {
        const newLang = await window.electronAPI.getSetting('language', 'zh-TW');
        setLanguage(newLang);
      }
    };

    window.addEventListener('language-changed', handleLanguageChange);
    return () => window.removeEventListener('language-changed', handleLanguageChange);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default { useTranslation, LanguageProvider, convertText };
