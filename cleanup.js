const fs = require('fs');
const path = require('path');

console.log('🧹 清理聲聲慢專案...');

// 需要清理的目录和文件
const cleanupTargets = [
  'src/dist',
  'dist',
  'node_modules/.cache',
  'cache',
  '*.log',
  'funasr_bridge.log'
];

// 递归删除目录
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`🗑️  删除目录: ${dirPath}`);
  }
}

// 删除文件
function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑️  删除文件: ${filePath}`);
  }
}

// 清理构建产物
const distPath = path.join(__dirname, 'src', 'dist');
const buildPath = path.join(__dirname, 'dist');
removeDir(distPath);
removeDir(buildPath);

// 清理缓存
const cachePath = path.join(__dirname, 'cache');
const nodeModulesCachePath = path.join(__dirname, 'node_modules', '.cache');
removeDir(cachePath);
removeDir(nodeModulesCachePath);

// 清理日志文件
const logFiles = [
  path.join(__dirname, 'funasr_bridge.log'),
  path.join(__dirname, 'electron.log'),
  path.join(__dirname, 'main.log')
];

logFiles.forEach(logFile => {
  removeFile(logFile);
});

// 清理临时文件
const tempFiles = fs.readdirSync(__dirname).filter(file => 
  file.endsWith('.tmp') || 
  file.endsWith('.temp') ||
  file.startsWith('temp_')
);

tempFiles.forEach(tempFile => {
  removeFile(path.join(__dirname, tempFile));
});

console.log('✅ 清理完成！');
console.log('💡 提示: 运行 pnpm install 重新安装依赖');