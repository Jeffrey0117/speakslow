# -*- coding: utf-8 -*-
"""
sherpa-onnx 自動錄音識別 Demo
自動錄製 5 秒音頻並識別
"""

import sys
import os
import time

# 設定 stdout 為 UTF-8
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# 模型路徑
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(SCRIPT_DIR, "sherpa-onnx-paraformer-zh-2023-09-14")

def main():
    print("=" * 60)
    print("  sherpa-onnx 自動錄音識別 Demo")
    print("  將自動錄製 5 秒音頻並識別")
    print("=" * 60)

    # 檢查依賴
    try:
        import sherpa_onnx
        import sounddevice as sd
        import numpy as np
    except ImportError as e:
        print(f"缺少依賴: {e}")
        return

    # 載入模型
    model_path = os.path.join(MODEL_DIR, "model.int8.onnx")
    tokens_path = os.path.join(MODEL_DIR, "tokens.txt")

    if not os.path.exists(model_path):
        print(f"模型文件不存在: {model_path}")
        return

    print("\n正在載入模型...")
    load_start = time.time()

    recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=model_path,
        tokens=tokens_path,
        num_threads=4,
        sample_rate=16000,
        feature_dim=80,
        decoding_method="greedy_search",
    )

    print(f"模型載入完成，耗時: {time.time() - load_start:.2f} 秒")

    # 錄音參數
    sample_rate = 16000
    duration = 5  # 錄製 5 秒

    print(f"\n🎤 開始錄音 {duration} 秒，請說話...")
    print("   (請用中文說一句話)")

    # 錄音
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='float32')
    sd.wait()

    audio = audio.flatten()
    print(f"✅ 錄音完成，音頻時長: {len(audio)/sample_rate:.2f} 秒")

    # 識別
    print("\n🔍 正在識別...")
    start = time.time()

    stream = recognizer.create_stream()
    stream.accept_waveform(sample_rate, audio)
    recognizer.decode_stream(stream)

    elapsed = time.time() - start
    result = stream.result.text
    actual_duration = len(audio) / sample_rate

    print("\n" + "=" * 60)
    print("識別結果:")
    print("=" * 60)
    print(f"\n📝 文字: {result if result else '(未識別到語音)'}")
    print(f"\n⏱️  處理時間: {elapsed:.3f} 秒")
    print(f"📊 RTF: {elapsed/actual_duration:.3f}")
    print(f"🚀 實時倍數: {actual_duration/elapsed:.1f}x (比實時快 {actual_duration/elapsed:.1f} 倍)")
    print("=" * 60)

if __name__ == "__main__":
    main()
