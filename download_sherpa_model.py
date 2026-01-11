#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sherpa-onnx 模型下載腳本
下載 Paraformer 中文語音識別模型
"""

import sys
import os
import json
import urllib.request
import tarfile
import shutil
from pathlib import Path

# 模型配置
MODEL_NAME = "sherpa-onnx-paraformer-zh-2023-09-14"
MODEL_URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/{MODEL_NAME}.tar.bz2"

# 模型目錄
SCRIPT_DIR = Path(__file__).parent.absolute()
MODEL_DIR = SCRIPT_DIR / "models" / MODEL_NAME


def report_progress(block_num, block_size, total_size):
    """報告下載進度"""
    downloaded = block_num * block_size
    if total_size > 0:
        percent = min(100, downloaded * 100 / total_size)
        downloaded_mb = downloaded / (1024 * 1024)
        total_mb = total_size / (1024 * 1024)
        status = {
            "stage": "downloading",
            "progress": round(percent, 1),
            "downloaded_mb": round(downloaded_mb, 1),
            "total_mb": round(total_mb, 1)
        }
        print(json.dumps(status, ensure_ascii=False))
        sys.stdout.flush()


def download_model():
    """下載並解壓模型"""

    # 檢查模型是否已存在
    model_file = MODEL_DIR / "model.int8.onnx"
    tokens_file = MODEL_DIR / "tokens.txt"

    if model_file.exists() and tokens_file.exists():
        status = {
            "stage": "completed",
            "message": "模型已存在，無需下載",
            "model_path": str(MODEL_DIR)
        }
        print(json.dumps(status, ensure_ascii=False))
        return True

    # 創建模型目錄
    MODEL_DIR.parent.mkdir(parents=True, exist_ok=True)

    # 下載文件
    tar_path = SCRIPT_DIR / f"{MODEL_NAME}.tar.bz2"

    status = {
        "stage": "starting",
        "message": f"開始下載模型: {MODEL_NAME}",
        "url": MODEL_URL
    }
    print(json.dumps(status, ensure_ascii=False))
    sys.stdout.flush()

    try:
        urllib.request.urlretrieve(MODEL_URL, tar_path, report_progress)
    except Exception as e:
        status = {
            "stage": "error",
            "error": f"下載失敗: {str(e)}"
        }
        print(json.dumps(status, ensure_ascii=False))
        return False

    # 解壓模型
    status = {
        "stage": "extracting",
        "message": "正在解壓模型..."
    }
    print(json.dumps(status, ensure_ascii=False))
    sys.stdout.flush()

    try:
        with tarfile.open(tar_path, "r:bz2") as tar:
            tar.extractall(path=SCRIPT_DIR / "models")
    except Exception as e:
        status = {
            "stage": "error",
            "error": f"解壓失敗: {str(e)}"
        }
        print(json.dumps(status, ensure_ascii=False))
        return False

    # 刪除壓縮包
    try:
        tar_path.unlink()
    except:
        pass

    # 驗證模型文件
    if not model_file.exists():
        status = {
            "stage": "error",
            "error": "模型文件不存在，解壓可能失敗"
        }
        print(json.dumps(status, ensure_ascii=False))
        return False

    status = {
        "stage": "completed",
        "success": True,
        "message": "模型下載完成",
        "model_path": str(MODEL_DIR)
    }
    print(json.dumps(status, ensure_ascii=False))
    return True


def verify_model():
    """驗證模型是否可用"""
    try:
        import sherpa_onnx

        model_path = str(MODEL_DIR / "model.int8.onnx")
        tokens_path = str(MODEL_DIR / "tokens.txt")

        if not os.path.exists(model_path):
            return False, "模型文件不存在"

        if not os.path.exists(tokens_path):
            return False, "tokens 文件不存在"

        # 嘗試載入模型
        recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
            paraformer=model_path,
            tokens=tokens_path,
            num_threads=1,
            sample_rate=16000,
            feature_dim=80,
            decoding_method="greedy_search",
        )

        return True, "模型驗證成功"

    except ImportError:
        return False, "sherpa-onnx 未安裝，請執行: pip install sherpa-onnx"
    except Exception as e:
        return False, f"模型驗證失敗: {str(e)}"


def main():
    """主函數"""
    print(json.dumps({
        "stage": "init",
        "message": "sherpa-onnx 模型下載工具",
        "model": MODEL_NAME
    }, ensure_ascii=False))
    sys.stdout.flush()

    # 下載模型
    success = download_model()

    if not success:
        sys.exit(1)

    # 驗證模型
    status = {
        "stage": "verifying",
        "message": "正在驗證模型..."
    }
    print(json.dumps(status, ensure_ascii=False))
    sys.stdout.flush()

    valid, message = verify_model()

    if valid:
        final_status = {
            "stage": "success",
            "success": True,
            "message": message,
            "model_path": str(MODEL_DIR),
            "files": {
                "model": str(MODEL_DIR / "model.int8.onnx"),
                "tokens": str(MODEL_DIR / "tokens.txt")
            }
        }
    else:
        final_status = {
            "stage": "warning",
            "success": True,
            "message": f"模型已下載，但驗證失敗: {message}",
            "model_path": str(MODEL_DIR)
        }

    print(json.dumps(final_status, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        error_result = {
            "stage": "error",
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)
