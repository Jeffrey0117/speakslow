#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
聲聲慢 Web API Server
基於 FastAPI 的 HTTP/WebSocket 服務，使用 Sherpa-ONNX 進行語音辨識
"""

import asyncio
import base64
import json
import logging
import os
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# 導入現有的 SherpaServer
from sherpa_server import SherpaServer, to_traditional, add_punctuation

# 設置日誌
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 全局 Sherpa 服務器實例
sherpa: Optional[SherpaServer] = None


# ==================== Pydantic Models ====================

class TranscribeRequest(BaseModel):
    """音訊辨識請求（Base64 編碼）"""
    audio_data: str  # Base64 encoded audio
    format: str = "wav"  # wav, webm, etc.
    options: dict = {}


class TranscribeResponse(BaseModel):
    """辨識結果"""
    success: bool
    text: str = ""
    raw_text: str = ""
    duration: float = 0.0
    processing_time: float = 0.0
    error: str = ""


class HotwordsConfig(BaseModel):
    """熱詞配置"""
    enabled: bool = True
    score: float = 1.5
    words: list[str] = []


class StatusResponse(BaseModel):
    """服務狀態"""
    status: str
    initialized: bool
    streaming_initialized: bool
    model_dir: str
    stats: dict = {}


# ==================== FastAPI App ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用生命週期管理"""
    global sherpa
    logger.info("正在初始化 Sherpa-ONNX 服務...")

    sherpa = SherpaServer()
    init_result = sherpa.initialize()

    if init_result.get("success"):
        logger.info("Sherpa-ONNX 離線辨識器初始化成功")
    else:
        logger.error(f"初始化失敗: {init_result.get('error')}")

    # 嘗試初始化串流辨識器
    try:
        stream_result = sherpa.initialize_streaming()
        if stream_result.get("success"):
            logger.info("Sherpa-ONNX 串流辨識器初始化成功")
    except Exception as e:
        logger.warning(f"串流辨識器初始化失敗: {e}")

    yield

    logger.info("服務關閉中...")
    if sherpa:
        sherpa.running = False


app = FastAPI(
    title="聲聲慢 API",
    description="SpeakSlow - 中文語音轉文字服務",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生產環境應限制來源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== HTTP Endpoints ====================

@app.get("/")
async def root():
    """API 根路徑"""
    return {
        "name": "聲聲慢 API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "status": "/status",
            "transcribe": "POST /transcribe",
            "transcribe_file": "POST /transcribe/file",
            "websocket": "WS /ws/stream",
            "hotwords": "/hotwords"
        }
    }


@app.get("/health")
async def health_check():
    """健康檢查"""
    return {
        "status": "healthy",
        "sherpa_ready": sherpa is not None and sherpa.initialized
    }


@app.get("/status", response_model=StatusResponse)
async def get_status():
    """獲取服務狀態"""
    if not sherpa:
        raise HTTPException(status_code=503, detail="服務未初始化")

    return StatusResponse(
        status="running",
        initialized=sherpa.initialized,
        streaming_initialized=sherpa.streaming_initialized,
        model_dir=sherpa.model_dir or "",
        stats=sherpa.get_performance_stats() if sherpa.initialized else {}
    )


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    辨識 Base64 編碼的音訊
    """
    if not sherpa or not sherpa.initialized:
        raise HTTPException(status_code=503, detail="辨識服務未就緒")

    start_time = time.time()

    try:
        # 解碼 Base64 音訊
        audio_bytes = base64.b64decode(request.audio_data)

        # 保存為臨時文件
        with tempfile.NamedTemporaryFile(suffix=f".{request.format}", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            # 調用辨識
            result = sherpa.transcribe_audio(temp_path, request.options)

            processing_time = time.time() - start_time

            if result.get("success"):
                return TranscribeResponse(
                    success=True,
                    text=result.get("text", ""),
                    raw_text=result.get("raw_text", ""),
                    duration=result.get("duration", 0.0),
                    processing_time=processing_time
                )
            else:
                return TranscribeResponse(
                    success=False,
                    error=result.get("error", "辨識失敗"),
                    processing_time=processing_time
                )
        finally:
            # 清理臨時文件
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        logger.error(f"辨識錯誤: {e}")
        return TranscribeResponse(
            success=False,
            error=str(e),
            processing_time=time.time() - start_time
        )


@app.post("/transcribe/file", response_model=TranscribeResponse)
async def transcribe_file(file: UploadFile = File(...)):
    """
    上傳音訊檔案進行辨識
    """
    if not sherpa or not sherpa.initialized:
        raise HTTPException(status_code=503, detail="辨識服務未就緒")

    start_time = time.time()

    # 獲取文件擴展名
    ext = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"

    try:
        # 保存上傳的文件
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            content = await file.read()
            f.write(content)
            temp_path = f.name

        try:
            result = sherpa.transcribe_audio(temp_path, {})
            processing_time = time.time() - start_time

            if result.get("success"):
                return TranscribeResponse(
                    success=True,
                    text=result.get("text", ""),
                    raw_text=result.get("raw_text", ""),
                    duration=result.get("duration", 0.0),
                    processing_time=processing_time
                )
            else:
                return TranscribeResponse(
                    success=False,
                    error=result.get("error", "辨識失敗"),
                    processing_time=processing_time
                )
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        logger.error(f"文件辨識錯誤: {e}")
        return TranscribeResponse(
            success=False,
            error=str(e),
            processing_time=time.time() - start_time
        )


# ==================== Hotwords ====================

@app.get("/hotwords")
async def get_hotwords():
    """獲取熱詞配置"""
    if not sherpa:
        raise HTTPException(status_code=503, detail="服務未初始化")

    result = sherpa.get_hotwords()
    return result


@app.post("/hotwords")
async def set_hotwords(config: HotwordsConfig):
    """設置熱詞配置"""
    if not sherpa:
        raise HTTPException(status_code=503, detail="服務未初始化")

    result = sherpa.set_hotwords({
        "enabled": config.enabled,
        "score": config.score,
        "words": config.words
    })
    return result


# ==================== WebSocket Streaming ====================

class ConnectionManager:
    """WebSocket 連接管理"""
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket 連接: {session_id}, 總連接數: {len(self.active_connections)}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        logger.info(f"WebSocket 斷開: {session_id}, 總連接數: {len(self.active_connections)}")


manager = ConnectionManager()


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket 串流辨識

    客戶端消息格式:
    - {"type": "start"} - 開始錄音
    - {"type": "audio", "data": "<base64>"} - 音訊數據
    - {"type": "stop"} - 停止錄音
    - {"type": "ping"} - 心跳

    服務器響應:
    - {"type": "ready", "session_id": "..."} - 準備就緒
    - {"type": "partial", "text": "..."} - 中間結果
    - {"type": "final", "text": "..."} - 最終結果
    - {"type": "error", "message": "..."} - 錯誤
    - {"type": "pong"} - 心跳響應
    """
    session_id = str(uuid.uuid4())
    await manager.connect(websocket, session_id)

    try:
        # 檢查串流辨識是否可用
        if not sherpa or not sherpa.streaming_initialized:
            await websocket.send_json({
                "type": "error",
                "message": "串流辨識服務未就緒，請使用離線辨識"
            })
            # 仍然保持連接，可以用離線模式

        await websocket.send_json({
            "type": "ready",
            "session_id": session_id,
            "streaming_available": sherpa.streaming_initialized if sherpa else False
        })

        # 音訊緩衝區（用於離線模式）
        audio_buffer = []
        is_recording = False

        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0  # 60秒超時
                )
                message = json.loads(data)
            except asyncio.TimeoutError:
                # 發送心跳
                await websocket.send_json({"type": "heartbeat"})
                continue
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "無效的 JSON 格式"
                })
                continue

            msg_type = message.get("type", "")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "start":
                # 開始錄音
                is_recording = True
                audio_buffer = []

                if sherpa and sherpa.streaming_initialized:
                    # 初始化串流會話
                    init_result = sherpa.stream_init(session_id, {})
                    if not init_result.get("success"):
                        logger.warning(f"串流初始化失敗: {init_result.get('error')}")

                await websocket.send_json({
                    "type": "started",
                    "mode": "streaming" if (sherpa and sherpa.streaming_initialized) else "offline"
                })

            elif msg_type == "audio":
                if not is_recording:
                    continue

                audio_b64 = message.get("data", "")
                if not audio_b64:
                    continue

                try:
                    audio_chunk = base64.b64decode(audio_b64)

                    if sherpa and sherpa.streaming_initialized:
                        # 串流模式：即時辨識
                        # 將 bytes 轉換為 base64 字符串給 stream_feed
                        feed_result = sherpa.stream_feed(session_id, audio_b64, is_final=False)

                        if feed_result.get("success") and feed_result.get("partial_text"):
                            await websocket.send_json({
                                "type": "partial",
                                "text": feed_result.get("partial_text", "")
                            })
                    else:
                        # 離線模式：累積音訊
                        audio_buffer.append(audio_chunk)

                except Exception as e:
                    logger.error(f"處理音訊錯誤: {e}")

            elif msg_type == "stop":
                is_recording = False

                if sherpa and sherpa.streaming_initialized:
                    # 串流模式：結束會話
                    end_result = sherpa.stream_end(session_id)
                    final_text = end_result.get("final_text", "")
                else:
                    # 離線模式：處理累積的音訊
                    if audio_buffer and sherpa:
                        # 合併音訊並辨識
                        full_audio = b"".join(audio_buffer)

                        # 保存為臨時 WAV 文件
                        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                            # 簡單的 WAV header (16kHz, 16-bit, mono)
                            import struct
                            sample_rate = 16000
                            num_channels = 1
                            bits_per_sample = 16

                            # 假設 audio_buffer 已經是 PCM 數據
                            data_size = len(full_audio)

                            f.write(b'RIFF')
                            f.write(struct.pack('<I', 36 + data_size))
                            f.write(b'WAVE')
                            f.write(b'fmt ')
                            f.write(struct.pack('<I', 16))
                            f.write(struct.pack('<H', 1))  # PCM
                            f.write(struct.pack('<H', num_channels))
                            f.write(struct.pack('<I', sample_rate))
                            f.write(struct.pack('<I', sample_rate * num_channels * bits_per_sample // 8))
                            f.write(struct.pack('<H', num_channels * bits_per_sample // 8))
                            f.write(struct.pack('<H', bits_per_sample))
                            f.write(b'data')
                            f.write(struct.pack('<I', data_size))
                            f.write(full_audio)
                            temp_path = f.name

                        try:
                            result = sherpa.transcribe_audio(temp_path, {})
                            final_text = result.get("text", "") if result.get("success") else ""
                        finally:
                            if os.path.exists(temp_path):
                                os.remove(temp_path)
                    else:
                        final_text = ""

                await websocket.send_json({
                    "type": "final",
                    "text": final_text
                })

                # 清空緩衝區
                audio_buffer = []

    except WebSocketDisconnect:
        logger.info(f"WebSocket 斷開: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket 錯誤: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        manager.disconnect(session_id)
        # 清理串流會話
        if sherpa and session_id in sherpa.streaming_sessions:
            try:
                sherpa.stream_end(session_id)
            except:
                pass


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8765"))

    logger.info(f"啟動聲聲慢 Web API: http://{host}:{port}")
    uvicorn.run(
        "sherpa_web_server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
