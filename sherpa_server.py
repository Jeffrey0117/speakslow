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
    使用連接詞分句 + 語氣詞 + 句末標點
    """
    if not text or not text.strip():
        return text

    import re
    text = text.strip()

    # 問句結尾詞（在句末時表示疑問）
    question_endings = ['嗎', '吗', '呢', '麼', '么']

    # 疑問詞（出現在文中表示疑問句）
    question_words = [
        '什麼', '什么', '怎麼', '怎么', '為什麼', '为什么',
        '哪裡', '哪里', '哪個', '哪个', '誰', '谁',
        '幾個', '几个', '多少', '是否', '能否', '可否',
        '有沒有', '有没有', '是不是', '會不會', '会不会',
        '怎樣', '怎样', '如何', '為何', '为何',
    ]

    # === 在這些詞【後面】加逗號 ===
    # 語氣詞（後面加逗號）
    particles_after = [
        '嘛', '啦', '呀', '囉', '咯', '噢', '唷',
        '哎', '欸', '啊', '喔', '哦', '嗯', '呃',
    ]

    # 疑問短語（後面加逗號或問號）
    question_phrases_after = [
        '不是嗎', '不是吗', '對不對', '对不对', '是不是',
        '好不好', '行不行', '可不可以', '對吧', '对吧',
        '是吧', '好嗎', '好吗',
    ]

    # === 在這些詞【前面】加逗號 ===
    # 注意：只放「幾乎一定是連接詞」的詞，避免誤判
    # 重要：長詞必須放在短詞前面，否則短詞會先匹配導致長詞被拆開
    sentence_starters = [
        # 「可」開頭的轉折（「可每當」「可每次」移到結構性斷句處理，避免衝突）
        '可現在', '可现在', '可他', '可她', '可我', '可你',
        '可這', '可这', '可那', '可誰', '可谁', '可當', '可当',
        # 長詞優先（這些很安全）
        '換句話說', '换句话说', '例如說', '例如说', '比如說', '比如说',
        '沒想到', '没想到', '想不到', '不是嗎', '不是吗',
        '要不是', '此時此刻', '此时此刻',
        # 轉折/連接（常用且安全的）
        '然後', '然后', '接著', '接着', '之後', '之后',
        '所以', '但是', '不過', '不过', '可是',
        '而且', '並且', '并且', '或者', '還是', '还是',
        '雖然', '虽然', '即使',
        '首先', '其次', '最後', '最后', '另外', '此外',
        '總之', '总之', '反正', '難怪', '难怪',
        '其實', '其实', '原來', '原来', '後來', '后来',
        '不然', '否則', '否则',
        '於是', '于是',
        '畢竟', '毕竟', '終於', '终于',
        '當然', '当然', '幸好', '幸虧', '幸亏',
        '竟是', '竟然', '居然',
        # 轉折代詞（這些很安全）
        '而他', '而她', '而我', '而你', '而它',
        '但他', '但她', '但我', '但你', '但它',
        # 強調詞
        '至少', '起碼', '起码',
        # 主詞+副詞（新句子開頭的強信號）
        # X就
        '我就', '你就', '他就', '她就', '它就',
        '我們就', '我们就', '你們就', '你们就', '他們就', '他们就',
        # X也
        '我也', '你也', '他也', '她也', '它也',
        '我們也', '我们也', '你們也', '你们也', '他們也', '他们也',
        # X又
        '我又', '你又', '他又', '她又', '它又',
        # X才
        '我才', '你才', '他才', '她才', '它才',
        # X都
        '我都', '你都', '他都', '她都', '它都',
        # X會/要/能/可
        '我會', '我会', '你會', '你会', '他會', '他会', '她會', '她会',
        '我要', '你要', '他要', '她要',
        '我能', '你能', '他能', '她能',
        '我可', '你可', '他可', '她可',
        # X便/正/在
        '我便', '你便', '他便', '她便',
        '我正', '你正', '他正', '她正',
        # 這就/那就
        '這就', '这就', '那就',
        # 讓步/對比
        '卻', '却', '反而', '偏偏',
        # 時間/條件開頭
        '自從', '自从', '直到', '等到', '過了', '过了',
        # 「每次」「每當」容易跟「可每當」衝突，用結構性斷句處理
        '當他', '當她', '當我', '當你', '當它', '当他', '当她', '当我', '当你', '当它',
        # 條件/假設
        '不需要', '不管',
        # 補充說明
        '也沒有', '也没有',
    ]

    # 檢查整段是否為問句
    is_question = any(text.endswith(w) for w in question_endings) or \
                  any(w in text for w in question_words)

    # 注意：移除了短句 early return，因為短句也可能需要斷句
    # 例如「她笑了笑他也跟著笑」只有 9 字但需要斷成「她笑了笑，他也跟著笑」

    result = text

    # 0. 保護複合詞（避免被錯誤斷開）
    # 用特殊標記暫時替換（保護詞不會被內部拆開）
    protected_words = [
        '自然而然', '理所當然', '理所当然', '順其自然', '顺其自然',
        '因此', '為此', '为此',  # 「因此」單獨出現才斷，不是「也沒有因此」
    ]
    for i, word in enumerate(protected_words):
        result = result.replace(word, f'__PROTECTED_{i}__')

    # 1. 在語氣詞後面加逗號
    for word in particles_after:
        # 語氣詞後面如果還有字，就加逗號
        pattern = f'({word})([^，。？！、；：])'
        result = re.sub(pattern, r'\1，\2', result)

    # 2. 在疑問短語後面加逗號
    for phrase in question_phrases_after:
        pattern = f'({phrase})([^，。？！、；：])'
        result = re.sub(pattern, r'\1，\2', result)

    # 3. 在句子連接詞前加逗號
    for word in sentence_starters:
        pattern = f'([^，。？！、；：])({word})'
        result = re.sub(pattern, r'\1，\2', result)

    # 4. 結構性斷句（「當...的時候」「如果...的話」等）
    # 處理順序很重要：長模式先處理，處理後保護，避免短模式拆開

    # 4.1 先處理最長的「可每當...的時候」並保護
    long_patterns = [
        (r'([^，。？！、；：])(可每當[^，。？！、；：]{1,15}的時候)', '可每當', '__KEMEIDANG__'),
        (r'([^，。？！、；：])(可每当[^，。？！、；：]{1,15}的时候)', '可每当', '__KEMEIDANG2__'),
        (r'([^，。？！、；：])(可每次)', '可每次', '__KEMEICI__'),
        (r'([^，。？！、；：])(每當[^，。？！、；：]{1,15}的時候)', '每當', '__MEIDANG__'),
        (r'([^，。？！、；：])(每当[^，。？！、；：]{1,15}的时候)', '每当', '__MEIDANG2__'),
    ]
    for pattern, word, placeholder in long_patterns:
        result = re.sub(pattern, r'\1，\2', result)
        result = result.replace(word, placeholder)

    # 4.2 處理短模式
    short_patterns = [
        r'([^，。？！、；：])(每次)',
        r'([^，。？！、；：])(每回)',
        r'([^，。？！、；：])(當[^，。？！、；：]{1,15}的時候)',
        r'([^，。？！、；：])(当[^，。？！、；：]{1,15}的时候)',
        r'([^，。？！、；：])(如果[^，。？！、；：]{1,15}的話)',
        r'([^，。？！、；：])(如果[^，。？！、；：]{1,15}的话)',
    ]
    for pattern in short_patterns:
        result = re.sub(pattern, r'\1，\2', result)

    # 4.3 還原保護的詞
    for pattern, word, placeholder in long_patterns:
        result = result.replace(placeholder, word)

    # 還原被保護的詞
    for i, word in enumerate(protected_words):
        result = result.replace(f'__PROTECTED_{i}__', word)

    # 清理連續的逗號
    result = re.sub(r'，+', '，', result)

    # 移除開頭的逗號
    if result.startswith('，'):
        result = result[1:]

    # 加上句末標點
    if result and result[-1] not in '，。？！、；：':
        if is_question:
            result += '？'
        else:
            result += '。'

    return result


class SherpaServer:
    def __init__(self, model_dir=None):
        self.recognizer = None
        self.punc_model = None  # FunASR 標點模型
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

    def _init_punctuation_model(self):
        """在背景線程初始化 FunASR 標點模型（ct-punc）"""
        import threading

        def load_punc_model():
            try:
                import time
                start_time = time.time()
                logger.info("正在載入 FunASR ct-punc 標點模型（背景）...")

                from funasr import AutoModel
                self.punc_model = AutoModel(model="ct-punc", model_revision="v2.0.4")

                load_time = time.time() - start_time
                logger.info(f"FunASR ct-punc 載入完成，耗時: {load_time:.2f} 秒")

            except ImportError as e:
                logger.warning(f"FunASR 未安裝，將使用規則式標點: {e}")
                self.punc_model = None
            except Exception as e:
                logger.warning(f"ct-punc 模型載入失敗，將使用規則式標點: {e}")
                self.punc_model = None

        # 在背景線程載入，不阻塞主服務
        thread = threading.Thread(target=load_punc_model, daemon=True)
        thread.start()

    def _add_punctuation(self, text):
        """使用 ct-punc 模型或規則式添加標點"""
        if not text or not text.strip():
            return text

        text = text.strip()

        # 優先使用 FunASR ct-punc 模型
        if self.punc_model is not None:
            try:
                result = self.punc_model.generate(input=text)
                if result and len(result) > 0:
                    # result 格式: [{'text': '帶標點的文字', ...}]
                    punctuated = result[0].get('text', text)
                    logger.debug(f"ct-punc 標點結果: {punctuated}")
                    return punctuated
            except Exception as e:
                logger.warning(f"ct-punc 處理失敗，使用規則式: {e}")

        # 備用：規則式標點
        return add_punctuation(text)

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

            # 嘗試載入 FunASR 標點模型
            self._init_punctuation_model()

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

            # 加入標點（優先使用 ct-punc 模型）
            text_with_punc = self._add_punctuation(text)

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
