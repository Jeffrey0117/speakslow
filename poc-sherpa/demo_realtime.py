# -*- coding: utf-8 -*-
"""
sherpa-onnx 即時體驗 Demo
錄製麥克風音頻並即時識別
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

def check_dependencies():
    """檢查必要依賴"""
    missing = []

    try:
        import sherpa_onnx
    except ImportError:
        missing.append("sherpa-onnx")

    try:
        import sounddevice
    except ImportError:
        missing.append("sounddevice")

    if missing:
        print(f"缺少依賴: {', '.join(missing)}")
        print(f"請執行: pip install {' '.join(missing)}")
        return False

    return True

def create_recognizer():
    """創建識別器"""
    import sherpa_onnx

    model_path = os.path.join(MODEL_DIR, "model.int8.onnx")
    tokens_path = os.path.join(MODEL_DIR, "tokens.txt")

    if not os.path.exists(model_path):
        print(f"模型文件不存在: {model_path}")
        print("請先執行 test_comparison.py 確保模型已下載解壓")
        return None

    print("正在載入 sherpa-onnx 模型...")
    start = time.time()

    recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=model_path,
        tokens=tokens_path,
        num_threads=4,
        sample_rate=16000,
        feature_dim=80,
        decoding_method="greedy_search",
    )

    print(f"模型載入完成，耗時: {time.time() - start:.2f} 秒")
    return recognizer

def record_and_transcribe():
    """錄製並識別"""
    import sounddevice as sd
    import numpy as np

    recognizer = create_recognizer()
    if not recognizer:
        return

    print("\n" + "=" * 50)
    print("sherpa-onnx 即時語音識別 Demo")
    print("=" * 50)
    print("\n按 Enter 開始錄音，錄音中按 Enter 停止")
    print("輸入 'q' 退出\n")

    sample_rate = 16000

    while True:
        cmd = input(">>> 按 Enter 開始錄音 (q 退出): ")
        if cmd.lower() == 'q':
            print("再見！")
            break

        print("🎤 開始錄音... (按 Enter 停止)")

        # 錄音
        audio_chunks = []
        recording = True

        def callback(indata, frames, time_info, status):
            if recording:
                audio_chunks.append(indata.copy())

        stream = sd.InputStream(
            samplerate=sample_rate,
            channels=1,
            dtype='float32',
            callback=callback
        )

        stream.start()
        input()  # 等待用戶按 Enter
        recording = False
        stream.stop()
        stream.close()

        # 合併音頻
        if not audio_chunks:
            print("未錄到音頻")
            continue

        audio = np.concatenate(audio_chunks).flatten()
        duration = len(audio) / sample_rate
        print(f"錄音完成，時長: {duration:.2f} 秒")

        # 識別
        print("🔍 正在識別...")
        start = time.time()

        stream = recognizer.create_stream()
        stream.accept_waveform(sample_rate, audio)
        recognizer.decode_stream(stream)

        elapsed = time.time() - start
        result = stream.result.text

        print(f"\n📝 識別結果: {result}")
        print(f"⏱️  處理時間: {elapsed:.3f} 秒 (RTF: {elapsed/duration:.3f})")
        print(f"🚀 實時倍數: {duration/elapsed:.1f}x")
        print("-" * 50)

def transcribe_file(file_path):
    """識別音頻文件"""
    import wave
    import numpy as np

    recognizer = create_recognizer()
    if not recognizer:
        return

    print(f"\n正在識別文件: {file_path}")

    # 讀取音頻
    with wave.open(file_path, 'rb') as wf:
        sample_rate = wf.getframerate()
        data = wf.readframes(wf.getnframes())
        samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0

    duration = len(samples) / sample_rate

    # 識別
    start = time.time()
    stream = recognizer.create_stream()
    stream.accept_waveform(sample_rate, samples)
    recognizer.decode_stream(stream)
    elapsed = time.time() - start

    result = stream.result.text

    print(f"\n📝 識別結果: {result}")
    print(f"⏱️  音頻時長: {duration:.2f} 秒")
    print(f"⏱️  處理時間: {elapsed:.3f} 秒")
    print(f"🚀 實時倍數: {duration/elapsed:.1f}x")

def main():
    print("=" * 60)
    print("  sherpa-onnx 中文語音識別體驗 Demo")
    print("  比 FunASR PyTorch 快 10+ 倍，記憶體省 75%")
    print("=" * 60)

    if not check_dependencies():
        return

    if len(sys.argv) > 1:
        # 識別指定文件
        transcribe_file(sys.argv[1])
    else:
        # 即時錄音識別
        record_and_transcribe()

if __name__ == "__main__":
    main()
