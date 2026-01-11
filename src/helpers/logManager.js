const fs = require('fs');
const path = require('path');
const os = require('os');

class LogManager {
  constructor() {
    // 使用臨時目錄作為初始值，等 Electron 準備好後再更新
    this.logDir = path.join(os.tmpdir(), 'ququ-logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.sherpaLogFile = path.join(this.logDir, 'sherpa.log');
    this._initialized = false;
    this.ensureLogDirectory();
  }

  // 嘗試更新到正確的日誌目錄
  _tryUpdateLogDir() {
    if (this._initialized) return;
    try {
      const electron = require('electron');
      if (electron.app && typeof electron.app.getPath === 'function') {
        const userDataPath = electron.app.getPath('userData');
        this.logDir = path.join(userDataPath, 'logs');
        this.logFile = path.join(this.logDir, 'app.log');
        this.sherpaLogFile = path.join(this.logDir, 'sherpa.log');
        this.ensureLogDirectory();
        this._initialized = true;
      }
    } catch (e) {
      // Electron 尚未準備好，使用臨時目錄
    }
  }

  getLogDirectory() {
    this._tryUpdateLogDir();
    return this.logDir;
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('创建日志目录失败:', error);
    }
  }

  log(level, message, data = null) {
    this._tryUpdateLogDir();
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid
    };

    // 输出到控制台
    console[level](`[${timestamp}] ${message}`, data || '');

    // 写入日志文件
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }

  info(message, data) {
    this.log('info', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  // 记录 Sherpa 相关日志
  logSherpa(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      source: 'Sherpa'
    };

    console[level](`[Sherpa] ${message}`, data || '');

    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.sherpaLogFile, logLine);
    } catch (error) {
      console.error('写入 Sherpa 日志文件失败:', error);
    }
  }

  // 获取最近的日志
  getRecentLogs(lines = 100) {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      const logLines = content.trim().split('\n').filter(line => line.trim());
      
      return logLines
        .slice(-lines)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        });
    } catch (error) {
      console.error('读取日志文件失败:', error);
      return [];
    }
  }

  // 获取 Sherpa 日志
  getSherpaLogs(lines = 100) {
    try {
      if (!fs.existsSync(this.sherpaLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.sherpaLogFile, 'utf8');
      const logLines = content.trim().split('\n').filter(line => line.trim());

      return logLines
        .slice(-lines)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        });
    } catch (error) {
      console.error('读取 Sherpa 日志文件失败:', error);
      return [];
    }
  }

  // 清理旧日志
  cleanOldLogs(daysToKeep = 7) {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      [this.logFile, this.sherpaLogFile].forEach(logFile => {
        if (fs.existsSync(logFile)) {
          const stats = fs.statSync(logFile);
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(logFile);
            this.info(`清理旧日志文件: ${logFile}`);
          }
        }
      });
    } catch (error) {
      console.error('清理旧日志失败:', error);
    }
  }

  // 获取日志文件路径
  getLogFilePath() {
    return this.logFile;
  }

  getSherpaLogFilePath() {
    return this.sherpaLogFile;
  }

  // 获取系统信息用于调试
  getSystemInfo() {
    this._tryUpdateLogDir();
    let appVersion = 'unknown';
    let userDataPath = this.logDir;
    try {
      const electron = require('electron');
      if (electron.app && typeof electron.app.getVersion === 'function') {
        appVersion = electron.app.getVersion();
        userDataPath = electron.app.getPath('userData');
      }
    } catch (e) {
      // Electron 尚未準備好
    }
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      appVersion,
      userDataPath,
      logDir: this.logDir,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH,
        PYTHON_PATH: process.env.PYTHON_PATH
      }
    };
  }
}

module.exports = LogManager;