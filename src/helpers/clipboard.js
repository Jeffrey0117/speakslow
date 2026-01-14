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
    // 先恢復焦點到之前的視窗，再貼上
    if (this.previousForegroundWindow) {
      this.safeLog("🔄 貼上前先恢復焦點到之前的視窗...");
      await this.restoreForegroundWindow();
      // 等待視窗切換完成
      await new Promise(r => setTimeout(r, 100));
    }

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
      dialogMessage = `🔒 聲聲慢需要輔助功能權限，但看起來您可能有來自先前版本的舊權限。

❗ 常見問題：如果您重新構建/重新安裝了聲聲慢，舊權限可能"卡住"並阻止新權限。

🔧 解決方法：
1. 打開系統設置 → 隱私與安全性 → 輔助功能
2. 查找任何舊的"聲聲慢"條目並刪除它們（點擊 - 按鈕）
3. 同時刪除任何顯示"Electron"或名稱不明確的條目
4. 點擊 + 按鈕並手動添加新的聲聲慢應用
5. 確保複選框已啟用
6. 重啟聲聲慢

⚠️ 這在開發期間重新構建應用時特別常見。

📝 沒有此權限，文字將只複製到剪貼簿（無自動貼上）。

您想現在打開系統設置嗎？`;
    } else {
      dialogMessage = `🔒 聲聲慢需要輔助功能權限才能將文字貼上到其他應用程式中。

📋 當前狀態：剪貼簿複製有效，但貼上（Cmd+V 模擬）失敗。

🔧 解決方法：
1. 打開系統設置（或較舊 macOS 上的系統偏好設置）
2. 轉到隱私與安全性 → 輔助功能
3. 點擊鎖圖標並輸入您的密碼
4. 將聲聲慢添加到列表中並勾選複選框
5. 重啟聲聲慢

⚠️ 沒有此權限，聽寫文字將只複製到剪貼簿但不會自動貼上。

💡 在生產版本中，此權限是完整功能所必需的。

您想現在打開系統設置嗎？`;
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

      // 使用 cscript + VBScript，比 PowerShell 快非常多
      // VBScript 透過 AppActivate 的方式取得視窗 handle 有點繞
      // 改用更直接的方法：mshta + JavaScript

      // 方法 1: 使用 mshta (最快，幾乎瞬間)
      try {
        const os = require('os');
        const path = require('path');
        const fs = require('fs');

        // 建立臨時的 HTA 腳本
        const htaPath = path.join(os.tmpdir(), 'get_fg_window.hta');
        const htaContent = `<html><head><script language="VBScript">
Set oShell = CreateObject("WScript.Shell")
' 直接輸出當前活動視窗的進程名
' HTA 無法直接取得 handle，改用另一種方式
CreateObject("Scripting.FileSystemObject").CreateTextFile("${path.join(os.tmpdir(), 'fg_handle.txt').replace(/\\/g, '\\\\')}").Write(1)
self.close
</script></head></html>`;

        // HTA 太慢，改用更簡單的方式
      } catch (e) {
        // 忽略
      }

      // 方法 2: 直接用 cmd 的方式，配合預編譯的 .NET assembly
      // 但這需要額外的檔案，太複雜

      // 使用 user32.dll GetForegroundWindow 取得真正的前景視窗
      const output = execSync(
        `powershell -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow();' -Name Win32 -Namespace Native; [Native.Win32]::GetForegroundWindow().ToInt64()"`,
        {
          encoding: 'utf8',
          timeout: 3000, // 3 秒
          windowsHide: true
        }
      );

      const handle = output.trim();
      if (handle && handle !== "0" && handle !== "") {
        this.previousForegroundWindow = handle;
        this.safeLog(`✅ 已儲存前景視窗 handle: ${handle}`);
        return { success: true, handle };
      } else {
        this.safeLog(`⚠️ 無法取得前景視窗 handle，但不影響基本功能`);
        // 不要 return error，讓程式繼續執行
        return { success: true, handle: null, message: "無法取得 handle，將使用剪貼簿模式" };
      }
    } catch (error) {
      // timeout 或其他錯誤時，不要阻止錄音功能
      this.safeLog(`⚠️ 取得前景視窗失敗: ${error.message}，將使用剪貼簿模式`);
      return { success: true, handle: null, message: "timeout，將使用剪貼簿模式" };
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

      // 使用 PowerShell 設定前景視窗（簡化版，不改變視窗狀態）
      const psCommand = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr ProcessId);
            [DllImport("kernel32.dll")]
            public static extern uint GetCurrentThreadId();
          }
"@
        $hwnd = [IntPtr]::new(${handle})

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

  /**
   * 發送 Enter 鍵（完全信任模式：貼上後自動送出）
   * @returns {Promise<{success: boolean}>}
   */
  async sendEnter() {
    try {
      this.safeLog("⏎ 發送 Enter 鍵（完全信任模式）");

      if (process.platform === "win32") {
        return await this.sendEnterWindows();
      } else if (process.platform === "darwin") {
        return await this.sendEnterMacOS();
      } else {
        return await this.sendEnterLinux();
      }
    } catch (error) {
      this.safeLog(`❌ 發送 Enter 失敗: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendEnterWindows() {
    return new Promise((resolve) => {
      const enterProcess = spawn("powershell", [
        "-Command",
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
      ]);

      enterProcess.on("close", (code) => {
        if (code === 0) {
          this.safeLog("✅ Enter 鍵發送成功");
          resolve({ success: true });
        } else {
          this.safeLog(`⚠️ Enter 鍵發送失敗，代碼 ${code}`);
          resolve({ success: false, error: `Exit code ${code}` });
        }
      });

      enterProcess.on("error", (error) => {
        this.safeLog(`❌ Enter 鍵發送錯誤: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
  }

  async sendEnterMacOS() {
    return new Promise((resolve) => {
      const enterProcess = spawn("osascript", [
        "-e",
        'tell application "System Events" to keystroke return',
      ]);

      enterProcess.on("close", (code) => {
        if (code === 0) {
          this.safeLog("✅ Enter 鍵發送成功 (macOS)");
          resolve({ success: true });
        } else {
          this.safeLog(`⚠️ Enter 鍵發送失敗 (macOS)，代碼 ${code}`);
          resolve({ success: false, error: `Exit code ${code}` });
        }
      });

      enterProcess.on("error", (error) => {
        this.safeLog(`❌ Enter 鍵發送錯誤 (macOS): ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
  }

  async sendEnterLinux() {
    return new Promise((resolve) => {
      const enterProcess = spawn("xdotool", ["key", "Return"]);

      enterProcess.on("close", (code) => {
        if (code === 0) {
          this.safeLog("✅ Enter 鍵發送成功 (Linux)");
          resolve({ success: true });
        } else {
          this.safeLog(`⚠️ Enter 鍵發送失敗 (Linux)，代碼 ${code}`);
          resolve({ success: false, error: `Exit code ${code}` });
        }
      });

      enterProcess.on("error", (error) => {
        this.safeLog(`❌ Enter 鍵發送錯誤 (Linux): ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
  }
}

module.exports = ClipboardManager;