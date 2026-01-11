#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sherpa-ONNX ASR 服務器
使用 ONNX Runtime 進行高速離線語音識別
比 FunASR PyTorch 版本快 10+ 倍，記憶體省 75%
"""

import sys
import json
import os
import logging
import traceback
import signal
import tempfile
import wave
import numpy as np

# 設置日誌
def get_log_path():
    if "ELECTRON_USER_DATA" in os.environ:
        log_dir = os.path.join(os.environ["ELECTRON_USER_DATA"], "logs")
    else:
        log_dir = os.path.join(tempfile.gettempdir(), "ququ_logs")
    os.makedirs(log_dir, exist_ok=True)
    return os.path.join(log_dir, "sherpa_server.log")

log_file_path = get_log_path()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_file_path, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)
logger.info(f"Sherpa-ONNX 服務器日誌文件: {log_file_path}")


def add_punctuation(text):
    """
    基於規則的簡易中文標點恢復
    在 AI 優化之前提供基本的標點符號
    """
    if not text or not text.strip():
        return text

    import re
    text = text.strip()

    # 問句關鍵詞
    question_words = [
        '嗎', '呢', '吧', '啊', '麼', '么',
        '什麼', '什么', '怎麼', '怎么', '為什麼', '为什么',
        '哪裡', '哪里', '哪個', '哪个', '誰', '谁',
        '幾', '几', '多少', '是否', '能否', '可否',
        '有沒有', '有没有', '是不是', '會不會', '会不会',
    ]

    # 句子結束詞（通常後面要加句號）
    statement_endings = [
        '了', '的', '過', '过', '著', '着',
        '好', '行', '對', '对', '是', '要',
    ]

    # 逗號暫停詞
    pause_words = [
        '然後', '然后', '接著', '接着', '之後', '之后',
        '所以', '因此', '但是', '不過', '不过', '可是',
        '而且', '並且', '并且', '或者', '還是', '还是',
        '如果', '假如', '雖然', '虽然', '即使', '就是',
        '那麼', '那么', '這樣', '这样', '那樣', '那样',
        '首先', '其次', '最後', '最后', '另外', '此外',
        '總之', '总之', '換句話說', '换句话说',
    ]

    # 檢查是否為問句
    is_question = any(word in text for word in question_words)

    # 如果文本很短（可能是單句）
    if len(text) < 30:
        if is_question:
            return text + '？'
        else:
            return text + '。'

    # 較長文本：嘗試加入逗號和句號
    result = text

    # 在暫停詞後加逗號
    for word in pause_words:
        # 只在詞後面沒有標點時添加
        pattern = f'({word})([^，。？！、])'
        result = re.sub(pattern, r'\1，\2', result)

    # 最後加上句末標點
    if result and result[-1] not in '，。？！、；：':
        if is_question:
            result += '？'
        else:
            result += '。'

    return result


class SherpaServer:
    def __init__(self, model_dir=None):
        self.recognizer = None
        self.initialized = False
        self.running = True
        self.transcription_count = 0
        self.total_audio_duration = 0.0

        # 模型目錄
        self.model_dir = model_dir or self._find_model_dir()

        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

    def _find_model_dir(self):
        """尋找 sherpa-onnx 模型目錄"""
        # 優先查找項目內的 poc-sherpa 目錄
        script_dir = os.path.dirname(os.path.abspath(__file__))
        poc_model = os.path.join(script_dir, "poc-sherpa", "sherpa-onnx-paraformer-zh-2023-09-14")
        if os.path.exists(poc_model):
            return poc_model

        # 查找用戶緩存目錄
        cache_dir = os.path.expanduser("~/.cache/sherpa-onnx")
        model_name = "sherpa-onnx-paraformer-zh-2023-09-14"
        cache_model = os.path.join(cache_dir, model_name)
        if os.path.exists(cache_model):
            return cache_model

        return poc_model  # 默認返回 poc 路徑

    def _signal_handler(self, signum, frame):
        logger.info(f"收到信號 {signum}，準備退出...")
        self.running = False

    def initialize(self):
        """初始化 sherpa-onnx 識別器"""
        if self.initialized:
            return {"success": True, "message": "模型已初始化"}

        try:
            import time
            start_time = time.time()
            logger.info(f"正在初始化 sherpa-onnx，模型目錄: {self.model_dir}")

            # 檢查模型文件
            model_path = os.path.join(self.model_dir, "model.int8.onnx")
            tokens_path = os.path.join(self.model_dir, "tokens.txt")

            if not os.path.exists(model_path):
                return {
                    "success": False,
                    "error": f"模型文件不存在: {model_path}",
                    "type": "models_not_downloaded"
                }

            if not os.path.exists(tokens_path):
                return {
                    "success": False,
                    "error": f"詞表文件不存在: {tokens_path}",
                    "type": "models_not_downloaded"
                }

            import sherpa_onnx

            # 創建識別器
            self.recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
                paraformer=model_path,
                tokens=tokens_path,
                num_threads=4,
                sample_rate=16000,
                feature_dim=80,
                decoding_method="greedy_search",
            )

            load_time = time.time() - start_time
            self.initialized = True
            logger.info(f"sherpa-onnx 初始化完成，耗時: {load_time:.2f} 秒")

            return {
                "success": True,
                "message": f"sherpa-onnx 初始化成功，耗時: {load_time:.2f} 秒",
            }

        except ImportError as e:
            error_msg = "sherpa-onnx 未安裝，請執行: pip install sherpa-onnx"
            logger.error(error_msg)
            return {"success": False, "error": error_msg, "type": "import_error"}

        except Exception as e:
            error_msg = f"sherpa-onnx 初始化失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"success": False, "error": error_msg, "type": "init_error"}

    def _read_wave_file(self, wav_path):
        """讀取 WAV 檔案"""
        with wave.open(wav_path, 'rb') as wf:
            sample_rate = wf.getframerate()
            num_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            num_frames = wf.getnframes()

            data = wf.readframes(num_frames)

            if sample_width == 2:
                samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            else:
                samples = np.frombuffer(data, dtype=np.int8).astype(np.float32) / 128.0

            if num_channels == 2:
                samples = samples.reshape(-1, 2).mean(axis=1)

            return samples, sample_rate

    def transcribe_audio(self, audio_path, options=None):
        """轉錄音頻文件"""
        if not self.initialized:
            init_result = self.initialize()
            if not init_result["success"]:
                return init_result

        try:
            import time

            if not os.path.exists(audio_path):
                return {"success": False, "error": f"音頻文件不存在: {audio_path}"}

            logger.info(f"開始轉錄音頻文件: {audio_path}")
            start_time = time.time()

            # 讀取音頻
            samples, sample_rate = self._read_wave_file(audio_path)
            duration = len(samples) / sample_rate

            # 創建流並識別
            stream = self.recognizer.create_stream()
            stream.accept_waveform(sample_rate, samples)

            # 執行識別
            self.recognizer.decode_stream(stream)
            text = stream.result.text

            elapsed = time.time() - start_time
            rtf = elapsed / duration

            self.transcription_count += 1
            self.total_audio_duration += duration

            # 加入基本標點
            text_with_punc = add_punctuation(text)

            logger.info(f"轉錄完成: {text_with_punc[:100]}... (RTF: {rtf:.3f})")

            return {
                "success": True,
                "text": text_with_punc,
                "raw_text": text,  # 保留原始無標點文本
                "confidence": 0.95,  # sherpa-onnx 不提供置信度，給個默認值
                "duration": duration,
                "language": "zh-CN",
                "model_type": "sherpa-onnx",
                "rtf": rtf,
                "process_time": elapsed,
            }

        except Exception as e:
            error_msg = f"音頻轉錄失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"success": False, "error": error_msg, "type": "transcription_error"}

    def check_status(self):
        """檢查狀態"""
        try:
            import sherpa_onnx
            return {
                "success": True,
                "installed": True,
                "initialized": self.initialized,
                "version": sherpa_onnx.__version__,
                "model_dir": self.model_dir,
                "models": {
                    "asr": self.recognizer is not None,
                    "vad": False,  # sherpa-onnx 可以獨立使用 VAD，但這裡暫不啟用
                    "punc": False,  # sherpa-onnx 不包含標點模型
                },
            }
        except ImportError:
            return {
                "success": False,
                "installed": False,
                "initialized": False,
                "error": "sherpa-onnx 未安裝",
            }

    def get_performance_stats(self):
        """獲取性能統計"""
        return {
            "transcription_count": self.transcription_count,
            "total_audio_duration": round(self.total_audio_duration, 2),
            "average_duration": round(
                self.total_audio_duration / max(1, self.transcription_count), 2
            ),
            "initialized": self.initialized,
            "engine": "sherpa-onnx",
        }

    def run(self):
        """運行服務器主循環"""
        logger.info("Sherpa-ONNX 服務器啟動")

        # 初始化
        init_result = self.initialize()
        print(json.dumps(init_result, ensure_ascii=False))
        sys.stdout.flush()

        while self.running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    command = json.loads(line)
                except json.JSONDecodeError:
                    result = {"success": False, "error": "無效的 JSON 命令"}
                    print(json.dumps(result, ensure_ascii=False))
                    sys.stdout.flush()
                    continue

                # 處理命令
                action = command.get("action")

                if action == "transcribe":
                    audio_path = command.get("audio_path")
                    options = command.get("options", {})
                    result = self.transcribe_audio(audio_path, options)
                elif action == "status":
                    result = self.check_status()
                elif action == "stats":
                    result = {"success": True, "stats": self.get_performance_stats()}
                elif action == "exit":
                    result = {"success": True, "message": "服務器退出"}
                    print(json.dumps(result, ensure_ascii=False))
                    sys.stdout.flush()
                    break
                else:
                    result = {"success": False, "error": f"未知命令: {action}"}

                print(json.dumps(result, ensure_ascii=False))
                sys.stdout.flush()

            except KeyboardInterrupt:
                break
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                }
                print(json.dumps(error_result, ensure_ascii=False))
                sys.stdout.flush()

        logger.info("Sherpa-ONNX 服務器退出")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=str, default=None,
                        help="sherpa-onnx 模型目錄")
    args = parser.parse_args()

    server = SherpaServer(model_dir=args.model_dir)
    server.run()
