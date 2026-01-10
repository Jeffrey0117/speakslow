import { useState, useRef, useCallback, useEffect } from 'react';
import { useModelStatus } from './useModelStatus';
import { convertText } from '../i18n';

/**
 * 串流錄音功能 Hook
 * 提供邊錄音邊辨識、即時顯示文字的功能
 */
export const useStreamingRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // 即時辨識文字
  const [partialText, setPartialText] = useState('');
  const [fullText, setFullText] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  // 串流辨識狀態
  const streamingActiveRef = useRef(false);

  // 音頻緩衝區（用於累積足夠的音頻數據）
  const audioBufferRef = useRef([]);
  const sendIntervalRef = useRef(null);

  // 使用模型狀態 Hook
  const modelStatus = useModelStatus();

  // 清理資源
  const cleanup = useCallback(() => {
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    audioBufferRef.current = [];
    streamingActiveRef.current = false;
  }, []);

  // 開始串流錄音
  const startStreaming = useCallback(async () => {
    try {
      setError(null);
      setPartialText('');
      setFullText('');

      // 檢查 FunASR 是否就緒
      if (!modelStatus.isReady) {
        if (modelStatus.isLoading) {
          throw new Error('FunASR 服務器正在啟動中，請稍候...');
        } else {
          throw new Error('FunASR 服務器未就緒，請檢查配置');
        }
      }

      // 檢查瀏覽器支援
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的瀏覽器不支援錄音功能');
      }

      // 請求麥克風權限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // 創建 AudioContext
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;

      // 創建音源節點
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 創建 ScriptProcessor 來獲取原始音頻數據
      // 注意：ScriptProcessor 已被標記為 deprecated，但 AudioWorklet 較複雜
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!streamingActiveRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // 轉換為 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        // 累積到緩衝區
        audioBufferRef.current.push(pcmData);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // 開始串流辨識會話
      if (window.electronAPI) {
        const startResult = await window.electronAPI.streamingStart();
        if (!startResult.success) {
          throw new Error(startResult.error || '無法開始串流辨識');
        }
      }

      streamingActiveRef.current = true;
      setIsRecording(true);

      // 定期發送音頻數據（每 600ms，配合模型的 chunk_size）
      sendIntervalRef.current = setInterval(async () => {
        if (!streamingActiveRef.current || audioBufferRef.current.length === 0) return;

        // 合併緩衝區中的所有數據
        const totalLength = audioBufferRef.current.reduce((sum, arr) => sum + arr.length, 0);
        const mergedBuffer = new Int16Array(totalLength);
        let offset = 0;
        for (const chunk of audioBufferRef.current) {
          mergedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        audioBufferRef.current = [];

        // 發送到後端進行辨識
        if (window.electronAPI && mergedBuffer.length > 0) {
          try {
            const result = await window.electronAPI.streamingFeed(
              Buffer.from(mergedBuffer.buffer).toString('base64'),
              false
            );

            if (result.success) {
              // 更新即時文字
              if (result.partial_text) {
                setPartialText(result.partial_text);
              }
              if (result.full_text) {
                setFullText(result.full_text);
              }
            }
          } catch (err) {
            console.error('串流辨識錯誤:', err);
          }
        }
      }, 600);

    } catch (err) {
      setError(`無法開始串流錄音: ${err.message}`);
      setIsRecording(false);
      cleanup();
    }
  }, [modelStatus.isReady, modelStatus.isLoading, cleanup]);

  // 停止串流錄音
  const stopStreaming = useCallback(async () => {
    if (!streamingActiveRef.current) return;

    streamingActiveRef.current = false;
    setIsProcessing(true);

    try {
      // 發送最後一批數據
      if (audioBufferRef.current.length > 0 && window.electronAPI) {
        const totalLength = audioBufferRef.current.reduce((sum, arr) => sum + arr.length, 0);
        const mergedBuffer = new Int16Array(totalLength);
        let offset = 0;
        for (const chunk of audioBufferRef.current) {
          mergedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        audioBufferRef.current = [];

        // 標記為最後一個 chunk
        await window.electronAPI.streamingFeed(
          Buffer.from(mergedBuffer.buffer).toString('base64'),
          true
        );
      }

      // 結束串流會話並獲取最終結果
      if (window.electronAPI) {
        const endResult = await window.electronAPI.streamingEnd();

        if (endResult.success && endResult.final_text) {
          let finalText = endResult.final_text;

          // 檢查是否需要轉換為繁體中文
          const targetLang = await window.electronAPI.getSetting('language', 'zh-TW');
          const shouldConvert = await window.electronAPI.getSetting('convert_transcription', true);

          if (shouldConvert && targetLang === 'zh-TW') {
            finalText = convertText(finalText, 'zh-TW');
          }

          setFullText(finalText);

          // 觸發完成回調
          if (window.onTranscriptionComplete) {
            window.onTranscriptionComplete({
              success: true,
              text: finalText,
              streaming: true
            });
          }

          // 保存轉錄記錄
          const transcriptionData = {
            raw_text: finalText,
            text: finalText,
            confidence: 0,
            language: targetLang,
            duration: 0,
            file_size: 0,
          };

          await window.electronAPI.saveTranscription(transcriptionData);
        }
      }
    } catch (err) {
      setError(`停止串流錄音失敗: ${err.message}`);
    } finally {
      cleanup();
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, [cleanup]);

  // 取消串流錄音
  const cancelStreaming = useCallback(() => {
    streamingActiveRef.current = false;
    cleanup();
    setIsRecording(false);
    setIsProcessing(false);
    setPartialText('');
    setFullText('');
    setError(null);
  }, [cleanup]);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    isProcessing,
    error,
    partialText,
    fullText,
    startStreaming,
    stopStreaming,
    cancelStreaming
  };
};
