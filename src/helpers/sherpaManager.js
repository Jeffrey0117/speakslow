const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const PythonInstaller = require("./pythonInstaller");
const { runCommand, TIMEOUTS } = require("../utils/process");

// 簡單的全局緩存，避免頻繁檢查
let globalModelCheckCache = null;
let globalModelCheckTime = 0;
const GLOBAL_CACHE_TIME = 2000; // 2秒緩存

class SherpaManager {
  constructor(logger = null) {
    this.logger = logger || console;
    this.pythonCmd = null;
    this.sherpaInstalled = null;
    this.isInitialized = false;
    this.pythonInstaller = new PythonInstaller();
    this.modelsInitialized = false;
    this.initializationPromise = null;
    this.serverProcess = null;
    this.serverReady = false;
    this.modelsDownloaded = null;

    // 簡化緩存
    this._cachedPythonEnv = null;
    this._lastEmbeddedCheck = null;

    // Sherpa-ONNX 模型配置（比 FunASR 簡單得多）
    this.modelConfig = {
      name: "sherpa-onnx-paraformer-zh-2023-09-14",
      expected_size: 223 * 1024 * 1024, // 約 223MB
      required_files: ["model.int8.onnx", "tokens.txt"],
    };
  }

  getSherpaServerPath() {
    // 獲取 Sherpa 服務器腳本路徑
    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      !require("electron").app?.isPackaged;

    if (isDevelopment) {
      return path.join(__dirname, "..", "..", "sherpa_server.py");
    } else {
      return path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "sherpa_server.py"
      );
    }
  }

  getEmbeddedPythonPath() {
    // 獲取嵌入式 Python 路徑
    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      !require("electron").app?.isPackaged;

    if (isDevelopment) {
      return path.join(__dirname, "..", "..", "python", "bin", "python3.11");
    } else {
      return path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "python",
        "bin",
        "python3.11"
      );
    }
  }

  setupIsolatedEnvironment() {
    // 設置 Python 環境變量
    const embeddedPythonPath = this.getEmbeddedPythonPath();
    const isUsingEmbedded = fs.existsSync(embeddedPythonPath);

    if (isUsingEmbedded) {
      const pythonHome = path.dirname(path.dirname(embeddedPythonPath));
      const sitePackages = path.join(
        pythonHome,
        "lib",
        "python3.11",
        "site-packages"
      );

      process.env.PYTHONHOME = pythonHome;
      process.env.PYTHONPATH = sitePackages;
      process.env.PYTHONDONTWRITEBYTECODE = "1";
      process.env.PYTHONIOENCODING = "utf-8";
      process.env.PYTHONUNBUFFERED = "1";

      this.logger.info &&
        this.logger.info("設置嵌入式 Python 環境", {
          PYTHONHOME: process.env.PYTHONHOME,
          PYTHONPATH: process.env.PYTHONPATH,
          pythonExecutable: embeddedPythonPath,
        });
    } else {
      delete process.env.PYTHONHOME;
      delete process.env.PYTHONPATH;

      process.env.PYTHONDONTWRITEBYTECODE = "1";
      process.env.PYTHONIOENCODING = "utf-8";
      process.env.PYTHONUNBUFFERED = "1";

      this.logger.info &&
        this.logger.info("設置系統 Python 環境", {
          note: "清除嵌入式 Python 環境變量，使用系統 Python 默認環境",
          pythonExecutable: this.pythonCmd || "未確定",
        });
    }

    delete process.env.PYTHONUSERBASE;
    delete process.env.PYTHONSTARTUP;
    delete process.env.VIRTUAL_ENV;
  }

  buildPythonEnvironment() {
    // 構建完整的 Python 環境變量
    const embeddedPythonPath = this.getEmbeddedPythonPath();
    const isUsingEmbedded = fs.existsSync(embeddedPythonPath);

    if (
      this._cachedPythonEnv &&
      this._lastEmbeddedCheck === isUsingEmbedded
    ) {
      return this._cachedPythonEnv;
    }

    let env = {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1",
      ELECTRON_USER_DATA: require("electron").app.getPath("userData"),
    };

    if (isUsingEmbedded) {
      const pythonHome = path.dirname(path.dirname(embeddedPythonPath));
      const sitePackages = path.join(
        pythonHome,
        "lib",
        "python3.11",
        "site-packages"
      );

      env.PYTHONHOME = pythonHome;
      env.PYTHONPATH = sitePackages;
      env.LD_LIBRARY_PATH = path.join(pythonHome, "lib");
      env.DYLD_LIBRARY_PATH = path.join(pythonHome, "lib");

      if (
        !this._cachedPythonEnv ||
        this._lastEmbeddedCheck !== isUsingEmbedded
      ) {
        this.logger.info &&
          this.logger.info("構建嵌入式 Python 環境變量", {
            PYTHONHOME: env.PYTHONHOME,
            PYTHONPATH: env.PYTHONPATH,
          });
      }
    } else {
      if (
        !this._cachedPythonEnv ||
        this._lastEmbeddedCheck !== isUsingEmbedded
      ) {
        this.logger.info &&
          this.logger.info("構建系統 Python 環境變量", {
            note: "使用系統 Python 默認環境",
          });
      }
    }

    delete env.PYTHONUSERBASE;
    delete env.PYTHONSTARTUP;
    delete env.VIRTUAL_ENV;

    this._cachedPythonEnv = env;
    this._lastEmbeddedCheck = isUsingEmbedded;

    return env;
  }

  /**
   * 獲取模型緩存路徑
   */
  getModelCachePath() {
    // Sherpa-ONNX 模型路徑
    const candidates = [
      // 項目內的 poc-sherpa 目錄
      path.join(__dirname, "..", "..", "poc-sherpa", this.modelConfig.name),
      // 用戶緩存目錄
      path.join(os.homedir(), ".cache", "sherpa-onnx", this.modelConfig.name),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.logger.info && this.logger.info("找到模型緩存路徑:", candidate);
        return candidate;
      }
    }

    // 默認返回 poc-sherpa 路徑（可能需要下載）
    return path.join(__dirname, "..", "..", "poc-sherpa", this.modelConfig.name);
  }

  async checkModelFiles() {
    /**
     * 檢查模型文件是否存在
     */
    const now = Date.now();

    if (
      globalModelCheckCache &&
      now - globalModelCheckTime < GLOBAL_CACHE_TIME &&
      !this.serverReady
    ) {
      return globalModelCheckCache;
    }

    try {
      const modelPath = this.getModelCachePath();
      this.logger.info && this.logger.info("檢查模型路徑:", modelPath);

      if (!fs.existsSync(modelPath)) {
        this.logger.info && this.logger.info("模型目錄不存在");
        this.modelsDownloaded = false;
        const result = {
          success: true,
          models_downloaded: false,
          missing_models: ["asr"],
          details: {
            model_path: modelPath,
            exists: false,
          },
        };

        globalModelCheckCache = result;
        globalModelCheckTime = now;
        return result;
      }

      // 檢查必要的文件
      const missingFiles = [];
      for (const file of this.modelConfig.required_files) {
        const filePath = path.join(modelPath, file);
        if (!fs.existsSync(filePath)) {
          missingFiles.push(file);
        }
      }

      const allDownloaded = missingFiles.length === 0;
      this.modelsDownloaded = allDownloaded;

      this.logger.info &&
        this.logger.info("模型檢查完成:", {
          allDownloaded,
          missingFiles,
          modelPath,
        });

      const result = {
        success: true,
        models_downloaded: allDownloaded,
        missing_models: missingFiles.length > 0 ? ["asr"] : [],
        details: {
          model_path: modelPath,
          missing_files: missingFiles,
        },
      };

      globalModelCheckCache = result;
      globalModelCheckTime = now;
      return result;
    } catch (error) {
      this.logger.error && this.logger.error("檢查模型文件失敗:", error);
      this.modelsDownloaded = false;
      return {
        success: false,
        error: error.message,
        models_downloaded: false,
        missing_models: ["asr"],
        details: {},
      };
    }
  }

  async getDownloadProgress() {
    /**
     * 獲取模型下載進度
     * Sherpa-ONNX 模型較小，通常一次性下載，這裡簡化處理
     */
    try {
      const modelPath = this.getModelCachePath();

      if (!fs.existsSync(modelPath)) {
        return {
          success: true,
          overall_progress: 0,
          models: {
            asr: {
              progress: 0,
              downloaded: 0,
              total: this.modelConfig.expected_size,
            },
          },
        };
      }

      // 檢查模型文件大小
      const modelFile = path.join(modelPath, "model.int8.onnx");
      let fileSize = 0;
      if (fs.existsSync(modelFile)) {
        const stats = fs.statSync(modelFile);
        fileSize = stats.size;
      }

      const progress = Math.min(
        100,
        (fileSize / this.modelConfig.expected_size) * 100
      );

      return {
        success: true,
        overall_progress: Math.round(progress * 10) / 10,
        models: {
          asr: {
            progress: Math.round(progress * 10) / 10,
            downloaded: fileSize,
            total: this.modelConfig.expected_size,
          },
        },
      };
    } catch (error) {
      this.logger.error && this.logger.error("獲取下載進度失敗:", error);
      return {
        success: false,
        error: error.message,
        overall_progress: 0,
        models: {},
      };
    }
  }

  async downloadModels(progressCallback = null) {
    /**
     * 下載 Sherpa-ONNX 模型
     * 模型較小（約 223MB），從 HuggingFace 下載
     */
    try {
      this.logger.info && this.logger.info("開始下載 Sherpa-ONNX 模型...");

      const checkResult = await this.checkModelFiles();
      if (checkResult.models_downloaded) {
        this.logger.info && this.logger.info("模型已存在，無需下載");
        return { success: true, message: "模型已存在，無需下載" };
      }

      if (progressCallback) {
        progressCallback({
          stage: "downloading",
          model: "asr",
          progress: 0,
          overall_progress: 0,
        });
      }

      // 下載邏輯：使用 huggingface-cli 或直接下載
      // 這裡簡化為提示用戶手動下載
      const downloadUrl =
        "https://huggingface.co/csukuangfj/sherpa-onnx-paraformer-zh-2023-09-14";

      this.logger.info && this.logger.info("請從以下地址下載模型:", downloadUrl);

      return {
        success: false,
        message: `請手動下載模型: ${downloadUrl}`,
        download_url: downloadUrl,
        target_path: this.getModelCachePath(),
      };
    } catch (error) {
      this.logger.error && this.logger.error("模型下載失敗:", error);
      throw error;
    }
  }

  async restartServer() {
    /**
     * 重啟 Sherpa 服務器
     */
    try {
      this.logger.info && this.logger.info("重啟 Sherpa 服務器...");

      if (this.serverProcess) {
        await this._stopSherpaServer();
        this.logger.info && this.logger.info("已停止現有 Sherpa 服務器");
      }

      this.serverReady = false;
      this.modelsInitialized = false;
      this.initializationPromise = null;
      this._clearModelCache();

      const modelStatus = await this.checkModelFiles();
      if (!modelStatus.models_downloaded) {
        throw new Error("模型文件未下載，無法啟動服務器");
      }

      this.initializationPromise = this._startSherpaServer();
      await this.initializationPromise;

      this.logger.info && this.logger.info("Sherpa 服務器重啟完成");
      return { success: true, message: "Sherpa 服務器重啟成功" };
    } catch (error) {
      this.logger.error && this.logger.error("重啟 Sherpa 服務器失敗:", error);
      return { success: false, error: error.message };
    }
  }

  _clearModelCache() {
    globalModelCheckCache = null;
    globalModelCheckTime = 0;
  }

  async initializeAtStartup() {
    try {
      this.logger.info && this.logger.info("Sherpa 管理器啟動初始化開始");

      const pythonCmd = await this.findPythonExecutable();
      this.logger.info && this.logger.info("Python 可執行文件找到", { pythonCmd });

      const sherpaStatus = await this.checkSherpaInstallation();
      this.logger.info &&
        this.logger.info("Sherpa-ONNX 安裝狀態檢查完成", sherpaStatus);

      this.isInitialized = true;

      // 預初始化模型
      this.preInitializeModels();
      this.logger.info && this.logger.info("Sherpa 管理器啟動初始化完成");
    } catch (error) {
      this.logger.warn &&
        this.logger.warn("Sherpa 啟動初始化失敗，但不影響應用啟動", error);
      this.isInitialized = true;
    }
  }

  async preInitializeModels() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._startSherpaServer();
    return this.initializationPromise;
  }

  async _startSherpaServer() {
    try {
      this.logger.info && this.logger.info("啟動 Sherpa 服務器...");

      const status = await this.checkSherpaInstallation();
      if (!status.installed) {
        this.logger.warn &&
          this.logger.warn("Sherpa-ONNX 未安裝，跳過服務器啟動");
        return;
      }

      const pythonCmd = await this.findPythonExecutable();
      const serverPath = this.getSherpaServerPath();
      this.logger.info &&
        this.logger.info("Sherpa 服務器配置", {
          pythonCmd,
          serverPath,
          serverExists: fs.existsSync(serverPath),
        });

      if (!fs.existsSync(serverPath)) {
        this.logger.error &&
          this.logger.error("Sherpa 服務器腳本未找到，跳過服務器啟動", {
            serverPath,
          });
        return;
      }

      this.setupIsolatedEnvironment();
      const pythonEnv = this.buildPythonEnvironment();

      return new Promise((resolve) => {
        const modelPath = this.getModelCachePath();

        this.serverProcess = spawn(
          pythonCmd,
          [serverPath, "--model-dir", modelPath],
          {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
            env: pythonEnv,
          }
        );

        let initResponseReceived = false;

        this.serverProcess.stdout.on("data", (data) => {
          const lines = data
            .toString()
            .split("\n")
            .filter((line) => line.trim());

          for (const line of lines) {
            this.logger.debug &&
              this.logger.debug("Sherpa 服務器輸出", { line });
            try {
              const result = JSON.parse(line);

              if (!initResponseReceived) {
                initResponseReceived = true;
                if (result.success) {
                  this.serverReady = true;
                  this.modelsInitialized = true;
                  this._clearModelCache();
                  this.logger.info &&
                    this.logger.info("Sherpa 服務器啟動成功，模型已初始化");
                } else {
                  this.logger.error &&
                    this.logger.error("Sherpa 服務器初始化失敗", result);
                }
                resolve();
              }
            } catch (parseError) {
              this.logger.debug &&
                this.logger.debug("Sherpa 服務器非 JSON 輸出", { line });
            }
          }
        });

        this.serverProcess.stderr.on("data", (data) => {
          const errorOutput = data.toString();
          this.logger.error &&
            this.logger.error("Sherpa 服務器錯誤輸出", { errorOutput });
        });

        this.serverProcess.on("close", (code) => {
          this.logger.warn &&
            this.logger.warn("Sherpa 服務器進程退出", { code });
          this.serverProcess = null;
          this.serverReady = false;
          this.modelsInitialized = false;

          if (!initResponseReceived) {
            resolve();
          }
        });

        this.serverProcess.on("error", (error) => {
          this.logger.error &&
            this.logger.error("Sherpa 服務器進程錯誤", error);
          this.serverProcess = null;
          this.serverReady = false;

          if (!initResponseReceived) {
            resolve();
          }
        });

        // Sherpa-ONNX 載入更快，30 秒超時應該足夠
        setTimeout(() => {
          if (!initResponseReceived) {
            this.logger.warn &&
              this.logger.warn("Sherpa 服務器啟動超時");
            if (this.serverProcess) {
              this.serverProcess.kill();
            }
            resolve();
          }
        }, 30000);
      });
    } catch (error) {
      this.logger.error && this.logger.error("啟動 Sherpa 服務器異常", error);
    }
  }

  async _sendServerCommand(command) {
    if (!this.serverProcess || !this.serverReady) {
      throw new Error("Sherpa 服務器未就緒");
    }

    return new Promise((resolve, reject) => {
      let responseReceived = false;

      const onData = (data) => {
        if (responseReceived) return;

        const lines = data
          .toString()
          .split("\n")
          .filter((line) => line.trim());

        for (const line of lines) {
          try {
            const result = JSON.parse(line);
            responseReceived = true;
            this.serverProcess.stdout.removeListener("data", onData);
            resolve(result);
            return;
          } catch (parseError) {
            // 忽略非 JSON 輸出
          }
        }
      };

      this.serverProcess.stdout.on("data", onData);
      this.serverProcess.stdin.write(JSON.stringify(command) + "\n");

      setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true;
          this.serverProcess.stdout.removeListener("data", onData);
          reject(new Error("服務器響應超時"));
        }
      }, 60000);
    });
  }

  async _stopSherpaServer() {
    if (this.serverProcess) {
      try {
        await this._sendServerCommand({ action: "exit" });
      } catch (error) {
        this.serverProcess.kill();
      }

      this.serverProcess = null;
      this.serverReady = false;
      this.modelsInitialized = false;
    }
  }

  async findPythonExecutable() {
    if (this.pythonCmd) {
      return this.pythonCmd;
    }

    const embeddedPython = this.getEmbeddedPythonPath();

    this.logger.info &&
      this.logger.info("檢查嵌入式 Python", {
        path: embeddedPython,
        exists: fs.existsSync(embeddedPython),
      });

    if (fs.existsSync(embeddedPython)) {
      try {
        this.setupIsolatedEnvironment();

        const version = await this.getPythonVersion(embeddedPython);
        if (this.isPythonVersionSupported(version)) {
          this.pythonCmd = embeddedPython;
          this.logger.info &&
            this.logger.info("使用嵌入式 Python", {
              path: embeddedPython,
              version: `${version.major}.${version.minor}`,
            });
          return embeddedPython;
        }
      } catch (error) {
        this.logger.warn && this.logger.warn("嵌入式 Python 不可用", error);
      }
    }

    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      !require("electron").app?.isPackaged;

    if (isDevelopment) {
      this.logger.warn && this.logger.warn("開發模式：回退到系統 Python");
      return await this.findPythonExecutableWithFallback();
    }

    throw new Error(
      "嵌入式 Python 環境不可用。請重新安裝應用或運行構建腳本準備 Python 環境。"
    );
  }

  async findPythonExecutableWithFallback() {
    const projectRoot = path.join(__dirname, "..", "..");

    const possiblePaths = [
      // Windows 路徑
      path.join(projectRoot, ".venv", "Scripts", "python.exe"),
      path.join(projectRoot, ".venv", "Scripts", "python3.exe"),
      // Unix/macOS 路徑
      path.join(projectRoot, ".venv", "bin", "python3.11"),
      path.join(projectRoot, ".venv", "bin", "python3"),
      path.join(projectRoot, ".venv", "bin", "python"),
      // 系統路徑
      "python3.11",
      "python3",
      "python",
      "/usr/bin/python3.11",
      "/usr/bin/python3",
      "/usr/local/bin/python3.11",
      "/usr/local/bin/python3",
      "/opt/homebrew/bin/python3.11",
      "/opt/homebrew/bin/python3",
      "/usr/bin/python",
      "/usr/local/bin/python",
    ];

    for (const pythonPath of possiblePaths) {
      try {
        const version = await this.getPythonVersion(pythonPath);
        if (this.isPythonVersionSupported(version)) {
          this.pythonCmd = pythonPath;
          return pythonPath;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error("未找到 Python 3.x。請安裝 Python 或使用 installPython()。");
  }

  async getPythonVersion(pythonPath) {
    return new Promise((resolve) => {
      const isEmbedded = pythonPath === this.getEmbeddedPythonPath();
      const env = isEmbedded ? this.buildPythonEnvironment() : process.env;

      const testProcess = spawn(pythonPath, ["--version"], { env: env });
      let output = "";

      testProcess.stdout.on("data", (data) => (output += data));
      testProcess.stderr.on("data", (data) => (output += data));

      testProcess.on("close", (code) => {
        if (code === 0) {
          const match = output.match(/Python (\d+)\.(\d+)/i);
          resolve(match ? { major: +match[1], minor: +match[2] } : null);
        } else {
          resolve(null);
        }
      });

      testProcess.on("error", () => resolve(null));
    });
  }

  isPythonVersionSupported(version) {
    return version && version.major === 3;
  }

  async installPython(progressCallback = null) {
    try {
      this.pythonCmd = null;

      const result = await this.pythonInstaller.installPython(progressCallback);

      try {
        await this.findPythonExecutable();
        return result;
      } catch (findError) {
        throw new Error(
          "Python 已安裝但在 PATH 中未找到。請重啟應用程序。"
        );
      }
    } catch (error) {
      this.logger.error && this.logger.error("Python 安裝失敗:", error);
      throw error;
    }
  }

  async checkPythonInstallation() {
    return await this.pythonInstaller.isPythonInstalled();
  }

  async checkSherpaInstallation() {
    // 如果有緩存結果則返回
    if (this.sherpaInstalled !== null) {
      return this.sherpaInstalled;
    }

    try {
      const pythonCmd = await this.findPythonExecutable();

      const result = await new Promise((resolve) => {
        const pythonEnv = this.buildPythonEnvironment();

        const checkProcess = spawn(
          pythonCmd,
          ["-c", 'import sherpa_onnx; print("OK")'],
          { env: pythonEnv }
        );

        let output = "";
        let errorOutput = "";

        checkProcess.stdout.on("data", (data) => {
          output += data.toString();
        });

        checkProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        checkProcess.on("close", (code) => {
          if (code === 0 && output.includes("OK")) {
            resolve({ installed: true, working: true });
          } else {
            this.logger.error &&
              this.logger.error("Sherpa-ONNX 檢查失敗", {
                code,
                output,
                errorOutput,
              });
            resolve({
              installed: false,
              working: false,
              error: errorOutput || output,
            });
          }
        });

        checkProcess.on("error", (error) => {
          resolve({ installed: false, working: false, error: error.message });
        });
      });

      this.sherpaInstalled = result;
      return result;
    } catch (error) {
      const errorResult = {
        installed: false,
        working: false,
        error: error.message,
      };
      this.sherpaInstalled = errorResult;
      return errorResult;
    }
  }

  async upgradePip(pythonCmd) {
    return runCommand(pythonCmd, ["-m", "pip", "install", "--upgrade", "pip"], {
      timeout: TIMEOUTS.PIP_UPGRADE,
    });
  }

  async installSherpa(progressCallback = null) {
    const pythonCmd = await this.findPythonExecutable();

    if (progressCallback) {
      progressCallback({ stage: "升級 pip...", percentage: 10 });
    }

    try {
      await this.upgradePip(pythonCmd);
    } catch (error) {
      this.logger.warn && this.logger.warn("pip 升級失敗:", error.message);
    }

    if (progressCallback) {
      progressCallback({ stage: "安裝 sherpa-onnx...", percentage: 30 });
    }

    try {
      // sherpa-onnx 安裝很簡單，只需要一個包
      await runCommand(pythonCmd, ["-m", "pip", "install", "-U", "sherpa-onnx"], {
        timeout: TIMEOUTS.DOWNLOAD,
      });

      if (progressCallback) {
        progressCallback({ stage: "安裝完成！", percentage: 100 });
      }

      this.sherpaInstalled = null;
      return { success: true, message: "Sherpa-ONNX 安裝成功" };
    } catch (error) {
      if (
        error.message.includes("Permission denied") ||
        error.message.includes("access is denied")
      ) {
        try {
          await runCommand(
            pythonCmd,
            ["-m", "pip", "install", "--user", "-U", "sherpa-onnx"],
            { timeout: TIMEOUTS.DOWNLOAD }
          );

          if (progressCallback) {
            progressCallback({ stage: "安裝完成！", percentage: 100 });
          }

          this.sherpaInstalled = null;
          return { success: true, message: "Sherpa-ONNX 安裝成功（用戶模式）" };
        } catch (userError) {
          throw new Error(`Sherpa-ONNX 安裝失敗: ${userError.message}`);
        }
      }

      throw new Error(error.message);
    }
  }

  // 保持與 FunASRManager 相同的 API 接口，方便前端調用
  async installFunASR(progressCallback = null) {
    return this.installSherpa(progressCallback);
  }

  async checkFunASRInstallation() {
    return this.checkSherpaInstallation();
  }

  async transcribeAudio(audioBlob, options = {}) {
    const status = await this.checkSherpaInstallation();
    if (!status.installed) {
      throw new Error("Sherpa-ONNX 未安裝。請先安裝 Sherpa-ONNX。");
    }

    if (!this.serverReady && this.initializationPromise) {
      this.logger.info && this.logger.info("等待 Sherpa 服務器就緒...");
      await this.initializationPromise;
    }

    const tempAudioPath = await this.createTempAudioFile(audioBlob);

    try {
      if (!this.serverReady) {
        throw new Error("Sherpa 服務器未就緒，請稍後重試");
      }

      this.logger.info &&
        this.logger.info("使用 Sherpa 服務器模式進行轉錄");
      const result = await this._sendServerCommand({
        action: "transcribe",
        audio_path: tempAudioPath,
        options: options,
      });

      if (!result.success) {
        throw new Error(result.error || "轉錄失敗");
      }

      return {
        success: true,
        text: result.text.trim(),
        raw_text: result.raw_text,
        confidence: result.confidence || 0.95,
        language: result.language || "zh-CN",
      };
    } catch (error) {
      throw error;
    } finally {
      await this.cleanupTempFile(tempAudioPath);
    }
  }

  async createTempAudioFile(audioBlob) {
    const tempDir = os.tmpdir();
    const filename = `sherpa_audio_${crypto.randomUUID()}.wav`;
    const tempAudioPath = path.join(tempDir, filename);

    this.logger.info && this.logger.info("創建臨時文件:", tempAudioPath);

    let buffer;
    if (audioBlob instanceof ArrayBuffer) {
      buffer = Buffer.from(audioBlob);
    } else if (audioBlob instanceof Uint8Array) {
      buffer = Buffer.from(audioBlob);
    } else if (typeof audioBlob === "string") {
      buffer = Buffer.from(audioBlob, "base64");
    } else if (audioBlob && audioBlob.buffer) {
      buffer = Buffer.from(audioBlob.buffer);
    } else {
      throw new Error(`不支持的音頻數據類型: ${typeof audioBlob}`);
    }

    this.logger.debug && this.logger.debug("緩衝區創建，大小:", buffer.length);

    await fs.promises.writeFile(tempAudioPath, buffer);

    const stats = await fs.promises.stat(tempAudioPath);
    this.logger.info &&
      this.logger.info("臨時音頻文件創建:", {
        path: tempAudioPath,
        size: stats.size,
        isFile: stats.isFile(),
      });

    if (stats.size === 0) {
      throw new Error("音頻文件為空");
    }

    return tempAudioPath;
  }

  async cleanupTempFile(tempAudioPath) {
    try {
      await fs.promises.unlink(tempAudioPath);
    } catch (cleanupError) {
      // 臨時文件清理錯誤不是關鍵問題
    }
  }

  async checkStatus() {
    try {
      if (this.serverReady) {
        const result = await this._sendServerCommand({ action: "status" });
        // 將 Python 返回的 initialized 映射到前端期望的 models_initialized
        return {
          ...result,
          models_initialized: result.initialized,
          server_ready: true,
        };
      } else {
        const installStatus = await this.checkSherpaInstallation();
        const modelStatus = await this.checkModelFiles();

        let error = "Sherpa-ONNX 未安裝";
        if (installStatus.installed) {
          if (!modelStatus.models_downloaded) {
            error = "模型文件未下載，請先下載模型";
          } else {
            error = "Sherpa 服務器正在啟動中...";
          }
        }

        return {
          success: installStatus.installed && modelStatus.models_downloaded,
          error: error,
          installed: installStatus.installed,
          models_downloaded: modelStatus.models_downloaded,
          missing_models: modelStatus.missing_models || [],
          initializing: this.initializationPromise !== null,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        installed: false,
        models_downloaded: false,
      };
    }
  }
}

module.exports = SherpaManager;
