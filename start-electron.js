#!/usr/bin/env node
// 啟動腳本 - 清除 ELECTRON_RUN_AS_NODE 環境變數

// 刪除會干擾 Electron 的環境變數
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const path = require('path');

// 獲取 electron 可執行文件路徑
const electronPath = require('electron');

// 獲取命令行參數
const args = process.argv.slice(2);

// 添加當前目錄作為 electron 的入口點（確保 '.' 在參數最前面）
args.unshift('.');

console.log('Starting Electron with:', electronPath);
console.log('Args:', args);
console.log('ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);

// 創建新的環境變數對象，不包含 ELECTRON_RUN_AS_NODE
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// 啟動 Electron
const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env: env
});

child.on('close', (code) => {
  process.exit(code);
});
