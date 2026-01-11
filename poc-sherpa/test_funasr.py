# -*- coding: utf-8 -*-
"""
FunASR 效果對比測試 (用相同音頻)
"""

import os
import sys
import time
import wave
import numpy as np

# 設定 stdout 為 UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 測試音頻路徑
TEST_WAVS_DIR = os.path.join(os.path.dirname(__file__), "sherpa-onnx-paraformer-zh-2023-09-14", "test_wavs")

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

def main():
    print("=" * 60)
    print("FunASR Paraformer 中文識別測試")
    print("=" * 60)

    # 初始化 FunASR
    print("\n正在載入模型...")
    load_start = time.time()

    from funasr import AutoModel

    model = AutoModel(
        model="paraformer-zh",
        vad_model="fsmn-vad",
        punc_model="ct-punc",
        device="cpu",
        ncpu=4
    )

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

        # 讀取音頻
        samples, sample_rate = read_wave_file(wav_path)
        duration = len(samples) / sample_rate
        total_audio_duration += duration

        # 識別
        start_time = time.time()
        result = model.generate(input=wav_path)
        elapsed = time.time() - start_time
        total_process_time += elapsed

        text = result[0].get('text', '') if result else ''
        rtf = elapsed / duration

        results.append({
            "file": filename,
            "desc": desc,
            "duration": duration,
            "elapsed": elapsed,
            "rtf": rtf,
            "result": text
        })

        print(f"\n[{desc}] {filename}")
        print(f"  音頻時長: {duration:.2f}s | 處理時間: {elapsed:.3f}s | RTF: {rtf:.3f}")
        print(f"  識別結果: {text}")

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
    output_file = os.path.join(os.path.dirname(__file__), "funasr_results.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "model": "funasr-paraformer-zh",
            "load_time": load_time,
            "total_audio_duration": total_audio_duration,
            "total_process_time": total_process_time,
            "avg_rtf": total_process_time / total_audio_duration,
            "results": results
        }, f, ensure_ascii=False, indent=2)
    print(f"\n結果已保存到: {output_file}")

if __name__ == "__main__":
    main()
