const { clipboard } = require("electron");
const { spawn, execSync } = require("child_process");

class ClipboardManager {
  constructor(logger) {
    // 初始化剪贴板管理器
    this.logger = logger;

    // Windows: 儲存之前的前景視窗 handle
    this.previousForegroundWindow = null;

    // 尝试加载 osascript 模块（仅在 macOS 上）
    this.osascript = null;
    if (process.platform === "darwin") {
      try {
        this.osascript = require("osascript");
        this.safeLog("✅ osascript 模块加载成功");
      } catch (error) {
        this.safeLog("⚠️ osascript 模块加载失败，将使用备用方法", error.message);
      }
    }
  }

  // 安全日志方法 - 使用logManager记录
  safeLog(message, data = null) {
    if (this.logger) {
      try {
        this.logger.info(message, data);
      } catch (error) {
        // 静默忽略 EPIPE 错误
        if (error.code !== "EPIPE") {
          process.stderr.write(`日志错误: ${error.message}\n`);
        }
      }
    }
  }

  // 简化的 macOS accessibility 检查
  async enableMacOSAccessibility() {
    if (process.platform !== "darwin") return true;
    
    try {
      this.safeLog("🔧 检查 macOS accessibility 权限");
      
      // 简化为基本的权限检查，不设置复杂的AXManualAccessibility
      const script = `
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          return frontApp
        end tell
      `;
      
      const testProcess = spawn("osascript", ["-e", script]);
      
      return new Promise((resolve) => {
        testProcess.on("close", (code) => {
          if (code === 0) {
            this.safeLog("✅ macOS accessibility 权限正常");
            resolve(true);
          } else {
            this.safeLog("⚠️ macOS accessibility 权限不足");
            resolve(false);
          }
        });
        
        testProcess.on("error", () => {
          this.safeLog("❌ accessibility 权限检查失败");
          resolve(false);
        });
      });
    } catch (error) {
      this.safeLog("❌ 检查 macOS accessibility 时出错:", error.message);
      return false;
    }
  }

  // 简化的文本插入方法 - 直接使用标准粘贴方式
  async insertTextDirectly(text) {
    // 简化实现，直接使用标准的粘贴方法
    this.safeLog("🎯 使用标准粘贴方式插入文本");
    return await this.pasteText(text);
  }

  async pasteText(text) {
    try {
      this.safeLog("🎯 pasteText:", text?.substring(0, 30));

      if (process.platform === "win32") {
        // Windows: 前端已經用 navigator.clipboard 寫入了
        // 這裡只需要嘗試自動貼上（模擬 Ctrl+V）
        this.safeLog("⌨️ 嘗試自動貼上 (SendKeys)");
        await this.pasteWindows();
        return;
      }

      // macOS/Linux: 使用 Electron clipboard
      const originalClipboard = clipboard.readText();
      clipboard.writeText(text);

      if (process.platform === "darwin") {
        // 简化权限检查，直接尝试粘贴
        this.safeLog("🔍 检查粘贴操作的辅助功能权限");
        const hasPermissions = await this.checkAccessibilityPermissions();

        if (!hasPermissions) {
          this.safeLog("⚠️ 没有辅助功能权限 - 文本仅复制到剪贴板");
          const errorMsg =
            "需要辅助功能权限才能自动粘贴。文本已复制到剪贴板 - 请手动使用 Cmd+V 粘贴。";
          throw new Error(errorMsg);
        }

        this.safeLog("✅ 权限已授予，尝试粘贴");
        return await this.pasteMacOS(originalClipboard);
      } else {
        // Linux
        return await this.pasteLinux(originalClipboard);
      }
    } catch (error) {
      throw error;
    }
  }

  async pasteMacOS(originalClipboard) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const pasteProcess = spawn("osascript", [
          "-e",
          'tell application "System Events" to keystroke "v" using command down',
        ]);

        let errorOutput = "";
        let hasTimedOut = false;

        pasteProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        pasteProcess.on("close", (code) => {
          if (hasTimedOut) return;

          // 首先清除超时
          clearTimeout(timeoutId);

          // 清理进程引用
          pasteProcess.removeAllListeners();

          if (code === 0) {
            this.safeLog("✅ 通过 Cmd+V 模拟成功粘贴文本");
            setTimeout(() => {
              clipboard.writeText(originalClipboard);
              this.safeLog("🔄 原始剪贴板内容已恢复");
            }, 100);
            resolve();
          } else {
            const errorMsg = `粘贴失败 (代码 ${code})。文本已复制到剪贴板 - 请手动使用 Cmd+V 粘贴。`;
            reject(new Error(errorMsg));
          }
        });

        pasteProcess.on("error", (error) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);
          pasteProcess.removeAllListeners();
          const errorMsg = `粘贴命令失败: ${error.message}。文本已复制到剪贴板 - 请手动使用 Cmd+V 粘贴。`;
          reject(new Error(errorMsg));
        });

        const timeoutId = setTimeout(() => {
          hasTimedOut = true;
          pasteProcess.kill("SIGKILL");
          pasteProcess.removeAllListeners();
          const errorMsg =
            "粘贴操作超时。文本已复制到剪贴板 - 请手动使用 Cmd+V 粘贴。";
          reject(new Error(errorMsg));
        }, 3000);
      }, 100);
    });
  }

  async pasteWindows() {
    // 不再需要 originalClipboard 參數，因為我們不恢復剪貼簿
    return new Promise((resolve) => {
      const pasteProcess = spawn("powershell", [
        "-Command",
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")',
      ]);

      pasteProcess.on("close", (code) => {
        if (code === 0) {
          this.safeLog("✅ SendKeys 貼上成功");
        } else {
          this.safeLog(`⚠️ SendKeys 返回代碼 ${code}，文字仍在剪貼簿，可手動 Ctrl+V`);
        }
        resolve();
      });

      pasteProcess.on("error", (error) => {
        this.safeLog(`⚠️ SendKeys 失敗: ${error.message}，文字仍在剪貼簿`);
        resolve();
      });
    });
  }

  async pasteLinux(originalClipboard) {
    return new Promise((resolve, reject) => {
      const pasteProcess = spawn("xdotool", ["key", "ctrl+v"]);

      pasteProcess.on("close", (code) => {
        if (code === 0) {
          // 文本粘贴成功
          setTimeout(() => {
            clipboard.writeText(originalClipboard);
          }, 100);
          resolve();
        } else {
          reject(
            new Error(
              `Linux 粘贴失败，代码 ${code}。文本已复制到剪贴板。`
            )
          );
        }
      });

      pasteProcess.on("error", (error) => {
        reject(
          new Error(
            `Linux 粘贴失败: ${error.message}。文本已复制到剪贴板。`
          )
        );
      });
    });
  }

  async checkAccessibilityPermissions() {
    if (process.platform !== "darwin") return true;

    return new Promise((resolve) => {
      // 检查辅助功能权限
      const testProcess = spawn("osascript", [
        "-e",
        'tell application "System Events" to get name of first process',
      ]);

      let testOutput = "";
      let testError = "";

      testProcess.stdout.on("data", (data) => {
        testOutput += data.toString();
      });

      testProcess.stderr.on("data", (data) => {
        testError += data.toString();
      });

      testProcess.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          this.showAccessibilityDialog(testError);
          resolve(false);
        }
      });

      testProcess.on("error", (error) => {
        resolve(false);
      });
    });
  }

  showAccessibilityDialog(testError) {
    const isStuckPermission =
      testError.includes("not allowed assistive access") ||
      testError.includes("(-1719)") ||
      testError.includes("(-25006)");

    let dialogMessage;
    if (isStuckPermission) {
      dialogMessage = `🔒 蛐蛐需要辅助功能权限，但看起来您可能有来自先前版本的旧权限。

❗ 常见问题：如果您重新构建/重新安装了蛐蛐，旧权限可能"卡住"并阻止新权限。

🔧 解决方法：
1. 打开系统设置 → 隐私与安全性 → 辅助功能
2. 查找任何旧的"蛐蛐"条目并删除它们（点击 - 按钮）
3. 同时删除任何显示"Electron"或名称不明确的条目
4. 点击 + 按钮并手动添加新的蛐蛐应用
5. 确保复选框已启用
6. 重启蛐蛐

⚠️ 这在开发期间重新构建应用时特别常见。

📝 没有此权限，文本将只复制到剪贴板（无自动粘贴）。

您想现在打开系统设置吗？`;
    } else {
      dialogMessage = `🔒 蛐蛐需要辅助功能权限才能将文本粘贴到其他应用程序中。

📋 当前状态：剪贴板复制有效，但粘贴（Cmd+V 模拟）失败。

🔧 解决方法：
1. 打开系统设置（或较旧 macOS 上的系统偏好设置）
2. 转到隐私与安全性 → 辅助功能
3. 点击锁图标并输入您的密码
4. 将蛐蛐添加到列表中并勾选复选框
5. 重启蛐蛐

⚠️ 没有此权限，听写文本将只复制到剪贴板但不会自动粘贴。

💡 在生产版本中，此权限是完整功能所必需的。

您想现在打开系统设置吗？`;
    }

    const permissionDialog = spawn("osascript", [
      "-e",
      `display dialog "${dialogMessage}" buttons {"取消", "打开系统设置"} default button "打开系统设置"`,
    ]);

    permissionDialog.on("close", (dialogCode) => {
      if (dialogCode === 0) {
        this.openSystemSettings();
      }
    });

    permissionDialog.on("error", (error) => {
      // 权限对话框错误 - 用户需要手动授予权限
    });
  }

  openSystemSettings() {
    const settingsCommands = [
      [
        "open",
        [
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        ],
      ],
      ["open", ["-b", "com.apple.systempreferences"]],
      ["open", ["/System/Library/PreferencePanes/Security.prefPane"]],
    ];

    let commandIndex = 0;
    const tryNextCommand = () => {
      if (commandIndex < settingsCommands.length) {
        const [cmd, args] = settingsCommands[commandIndex];
        const settingsProcess = spawn(cmd, args);

        settingsProcess.on("error", (error) => {
          commandIndex++;
          tryNextCommand();
        });

        settingsProcess.on("close", (settingsCode) => {
          if (settingsCode !== 0) {
            commandIndex++;
            tryNextCommand();
          }
        });
      } else {
        // 所有设置命令都失败，尝试后备方案
        spawn("open", ["-a", "System Preferences"]).on("error", () => {
          spawn("open", ["-a", "System Settings"]).on("error", () => {
            // 无法打开设置应用
          });
        });
      }
    };

    tryNextCommand();
  }

  /**
   * Windows: 儲存當前前景視窗 (在錄音開始前呼叫)
   * 使用同步方式確保在熱鍵觸發時立即獲取
   * @returns {{success: boolean, handle?: string}}
   */
  saveForegroundWindow() {
    if (process.platform !== "win32") {
      return { success: true, message: "非 Windows 平台" };
    }

    try {
      this.safeLog("🔍 同步獲取前景視窗 handle...");

      // 使用更簡單的 PowerShell 命令，速度更快
      // 注意：需要正確轉義引號
      const psCommand = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\\\"user32.dll\\\")]public static extern IntPtr GetForegroundWindow();}';[W]::GetForegroundWindow().ToInt64()`;

      const output = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`,
        {
          encoding: 'utf8',
          timeout: 1000, // 1秒超時
          windowsHide: true
        }
      );

      const handle = output.trim();
      if (handle && handle !== "0") {
        this.previousForegroundWindow = handle;
        this.safeLog(`✅ 已儲存前景視窗 handle: ${handle}`);
        return { success: true, handle };
      } else {
        this.safeLog(`⚠️ 無法取得前景視窗 handle: 空結果或 0`);
        return { success: false, error: "空結果" };
      }
    } catch (error) {
      this.safeLog(`❌ 取得前景視窗失敗: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Windows: 恢復焦點到之前儲存的視窗
   * @returns {Promise<{success: boolean}>}
   */
  async restoreForegroundWindow() {
    if (process.platform !== "win32") {
      return { success: true, message: "非 Windows 平台" };
    }

    if (!this.previousForegroundWindow) {
      this.safeLog("⚠️ 沒有儲存的前景視窗 handle");
      return { success: false, error: "沒有儲存的前景視窗" };
    }

    return new Promise((resolve) => {
      const handle = this.previousForegroundWindow;
      this.safeLog(`🔄 嘗試恢復焦點到視窗 handle: ${handle}`);

      // 使用 PowerShell 設定前景視窗
      const psCommand = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")]
            public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr ProcessId);
            [DllImport("kernel32.dll")]
            public static extern uint GetCurrentThreadId();
          }
"@
        $hwnd = [IntPtr]::new(${handle})

        # 先 ShowWindow 確保視窗不是最小化
        [Win32]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE = 9

        # 嘗試 AttachThreadInput 讓 SetForegroundWindow 更可靠
        $foregroundThread = [Win32]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)
        $currentThread = [Win32]::GetCurrentThreadId()

        if ($foregroundThread -ne $currentThread) {
          [Win32]::AttachThreadInput($currentThread, $foregroundThread, $true) | Out-Null
        }

        $result = [Win32]::SetForegroundWindow($hwnd)

        if ($foregroundThread -ne $currentThread) {
          [Win32]::AttachThreadInput($currentThread, $foregroundThread, $false) | Out-Null
        }

        $result
      `;

      const setWindowProcess = spawn("powershell", ["-Command", psCommand]);

      let output = "";
      let errorOutput = "";

      setWindowProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      setWindowProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      setWindowProcess.on("close", (code) => {
        if (code === 0) {
          const success = output.trim().toLowerCase() === "true";
          if (success) {
            this.safeLog(`✅ 已恢復焦點到視窗 handle: ${handle}`);
          } else {
            this.safeLog(`⚠️ SetForegroundWindow 返回 false，可能需要手動點擊`);
          }
          resolve({ success });
        } else {
          this.safeLog(`⚠️ 恢復焦點失敗: ${errorOutput}`);
          resolve({ success: false, error: errorOutput });
        }
      });

      setWindowProcess.on("error", (error) => {
        this.safeLog(`❌ 恢復焦點失敗: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise<{success: boolean}>}
   */
  async copyText(text) {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 从剪贴板读取文本
   * @returns {Promise<string>}
   */
  async readClipboard() {
    try {
      const text = clipboard.readText();
      return text;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 将文本写入剪贴板
   * @param {string} text - 要写入的文本
   * @returns {Promise<{success: boolean}>}
   */
  async writeClipboard(text) {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ClipboardManager;