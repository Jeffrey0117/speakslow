#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模型下載腳本入口（已遷移到 sherpa-onnx）

此腳本已棄用，請使用 download_sherpa_model.py 代替。
為保持向後兼容，此腳本會自動調用新腳本。
"""

import sys
import os

def main():
    """重定向到新的下載腳本"""
    print("注意：此腳本已遷移到 download_sherpa_model.py")
    print("正在自動調用新腳本...")
    print("")

    # 獲取腳本目錄
    script_dir = os.path.dirname(os.path.abspath(__file__))
    new_script = os.path.join(script_dir, "download_sherpa_model.py")

    # 執行新腳本
    os.system(f'"{sys.executable}" "{new_script}"')

if __name__ == "__main__":
    main()