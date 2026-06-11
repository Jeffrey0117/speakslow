#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統一下載 ququ 所需的 sherpa-onnx 模型到 poc-sherpa/。

包含三個模型：
  1. 離線辨識 (Paraformer)   - 一般錄音/Typeless 模式使用
  2. 標點 (ct-transformer)   - 自動標點
  3. 串流辨識 (Zipformer)    - 即時逐字辨識（串流模式）

這些大檔（*.onnx）已在 .gitignore 中排除，需要時執行本腳本下載即可。
用法： python download_all_models.py
"""

import os
import sys
import tarfile
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
POC_DIR = os.path.join(SCRIPT_DIR, "poc-sherpa")

BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download"

# (顯示名稱, 下載 URL, 解壓後資料夾, 用來判斷是否已下載的關鍵檔)
MODELS = [
    (
        "離線辨識 Paraformer",
        f"{BASE}/asr-models/sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2",
        "sherpa-onnx-paraformer-zh-2023-09-14",
        "model.int8.onnx",
    ),
    (
        "標點 ct-transformer",
        f"{BASE}/punctuation-models/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12.tar.bz2",
        "sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12",
        "model.onnx",
    ),
    (
        "串流辨識 Zipformer",
        f"{BASE}/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2",
        "sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20",
        "encoder-epoch-99-avg-1.onnx",
    ),
]


def _progress(block_num, block_size, total_size):
    if total_size <= 0:
        return
    pct = min(100, block_num * block_size * 100 / total_size)
    mb = block_num * block_size / (1024 * 1024)
    total_mb = total_size / (1024 * 1024)
    sys.stdout.write(f"\r  下載中: {pct:5.1f}%  ({mb:.0f}/{total_mb:.0f} MB)")
    sys.stdout.flush()


def download_model(name, url, folder, key_file):
    target_dir = os.path.join(POC_DIR, folder)
    key_path = os.path.join(target_dir, key_file)

    if os.path.exists(key_path):
        print(f"[跳過] {name}：已存在 ({key_file})")
        return True

    os.makedirs(POC_DIR, exist_ok=True)
    tar_path = os.path.join(POC_DIR, folder + ".tar.bz2")

    print(f"[下載] {name}")
    print(f"  來源: {url}")
    try:
        urllib.request.urlretrieve(url, tar_path, _progress)
        print()
    except Exception as e:
        print(f"\n  ❌ 下載失敗: {e}")
        return False

    print("  解壓中...")
    try:
        with tarfile.open(tar_path, "r:bz2") as tar:
            tar.extractall(path=POC_DIR)
    except Exception as e:
        print(f"  ❌ 解壓失敗: {e}")
        return False
    finally:
        try:
            os.remove(tar_path)
        except OSError:
            pass

    if os.path.exists(key_path):
        print(f"  ✅ 完成: {folder}")
        return True
    print(f"  ❌ 解壓後仍找不到關鍵檔: {key_path}")
    return False


def main():
    print("=== ququ 模型下載工具 ===\n")
    ok = True
    for name, url, folder, key_file in MODELS:
        if not download_model(name, url, folder, key_file):
            ok = False
        print()

    if ok:
        print("✅ 全部模型已就緒")
        sys.exit(0)
    else:
        print("⚠️ 部分模型下載失敗，請檢查網路後重試")
        sys.exit(1)


if __name__ == "__main__":
    main()
