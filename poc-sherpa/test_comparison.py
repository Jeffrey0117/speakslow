# -*- coding: utf-8 -*-
"""
sherpa-onnx vs FunASR 效果對比測試
測試項目：
1. 識別準確度
2. 識別速度
3. 記憶體佔用
"""

import os
import sys
import time
import wave
import numpy as np
import sherpa_onnx

# 設定 stdout 為 UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 模型路徑
MODEL_DIR = os.path.join(os.path.dirname(__file__), "sherpa-onnx-paraformer-zh-2023-09-14")
TEST_WAVS_DIR = os.path.join(MODEL_DIR, "test_wavs")

def read_wave_file(wav_path):
    """讀取 WAV 檔案"""
    with wave.open(wav_path, 'rb') as wf:
        sample_rate = wf.getframerate()
        num_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        num_frames = wf.getnframes()

        data = wf.readframes(num_frames)

        # 轉換為 numpy array
        if sample_width == 2:
            samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        else:
            samples = np.frombuffer(data, dtype=np.int8).astype(np.float32) / 128.0

        # 如果是立體聲，轉為單聲道
        if num_channels == 2:
            samples = samples.reshape(-1, 2).mean(axis=1)

        return samples, sample_rate

def create_recognizer():
    """創建 sherpa-onnx 離線識別器"""
    recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=os.path.join(MODEL_DIR, "model.int8.onnx"),
        tokens=os.path.join(MODEL_DIR, "tokens.txt"),
        num_threads=4,
        sample_rate=16000,
        feature_dim=80,
        decoding_method="greedy_search",
    )
    return recognizer

def test_single_file(recognizer, wav_path):
    """測試單個音頻檔案"""
    # 讀取音頻
    samples, sample_rate = read_wave_file(wav_path)
    duration = len(samples) / sample_rate

    # 創建流
    stream = recognizer.create_stream()
    stream.accept_waveform(sample_rate, samples)

    # 識別
    start_time = time.time()
    recognizer.decode_stream(stream)
    elapsed = time.time() - start_time

    result = stream.result.text

    return result, elapsed, duration

def main():
    print("=" * 60)
    print("sherpa-onnx Paraformer 中文識別測試")
    print("=" * 60)

    # 初始化識別器
    print("\n正在載入模型...")
    load_start = time.time()
    recognizer = create_recognizer()
    load_time = time.time() - load_start
    print(f"模型載入完成，耗時: {load_time:.2f} 秒")

    # 測試所有音頻
    test_files = [
        ("0.wav", "標準普通話"),
        ("1.wav", "標準普通話"),
        ("2.wav", "標準普通話"),
        ("3-sichuan.wav", "四川方言"),
        ("4-tianjin.wav", "天津方言"),
        ("5-henan.wav", "河南方言"),
        ("6-zh-en.wav", "中英混合"),
    ]

    print("\n" + "-" * 60)
    print("識別結果:")
    print("-" * 60)

    total_audio_duration = 0
    total_process_time = 0
    results = []

    for filename, desc in test_files:
        wav_path = os.path.join(TEST_WAVS_DIR, filename)
        if not os.path.exists(wav_path):
            print(f"[跳過] {filename} - 檔案不存在")
            continue

        result, elapsed, duration = test_single_file(recognizer, wav_path)
        total_audio_duration += duration
        total_process_time += elapsed

        rtf = elapsed / duration  # 實時率
        results.append({
            "file": filename,
            "desc": desc,
            "duration": duration,
            "elapsed": elapsed,
            "rtf": rtf,
            "result": result
        })
        print(f"\n[{desc}] {filename}")
        print(f"  音頻時長: {duration:.2f}s | 處理時間: {elapsed:.3f}s | RTF: {rtf:.3f}")
        print(f"  識別結果: {result}")

    print("\n" + "=" * 60)
    print("統計摘要:")
    print("=" * 60)
    print(f"總音頻時長: {total_audio_duration:.2f} 秒")
    print(f"總處理時間: {total_process_time:.3f} 秒")
    print(f"平均 RTF: {total_process_time / total_audio_duration:.3f}")
    print(f"實時倍數: {total_audio_duration / total_process_time:.1f}x")

    # 記憶體使用情況
    try:
        import psutil
        process = psutil.Process()
        mem_info = process.memory_info()
        print(f"\n記憶體使用: {mem_info.rss / 1024 / 1024:.1f} MB")
    except ImportError:
        print("\n(安裝 psutil 可查看記憶體使用情況)")

    # 輸出 JSON 格式結果供進一步分析
    import json
    output_file = os.path.join(os.path.dirname(__file__), "sherpa_results.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "model": "sherpa-onnx-paraformer-zh-2023-09-14",
            "load_time": load_time,
            "total_audio_duration": total_audio_duration,
            "total_process_time": total_process_time,
            "avg_rtf": total_process_time / total_audio_duration,
            "results": results
        }, f, ensure_ascii=False, indent=2)
    print(f"\n結果已保存到: {output_file}")

if __name__ == "__main__":
    main()
