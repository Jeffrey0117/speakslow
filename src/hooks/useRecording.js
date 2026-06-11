import { useState, useRef, useCallback, useEffect } from 'react';
import { useModelStatus } from './useModelStatus';
import { convertText } from '../i18n';

/**
 * 录音功能Hook
 * 提供录音、停止录音、音频处理等功能
 */
export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState(null);
  const [audioData, setAudioData] = useState(null);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  // PCM 音頻數據緩衝區（直接錄製 PCM，不需要解碼 webm）
  const pcmBufferRef = useRef([]);

  // 添加防重复处理机制
  const processingRef = useRef({ isProcessingAudio: false, lastProcessTime: 0 });

  // 麥克風權限狀態快取
  const micPermissionRef = useRef('unknown');

  // 使用模型状态Hook
  const modelStatus = useModelStatus();

  // 預查詢麥克風權限狀態
  useEffect(() => {
    const checkMicPermission = async () => {
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' });
          micPermissionRef.current = result.state;
          result.onchange = () => {
            micPermissionRef.current = result.state;
          };
        } catch (e) {
          // 某些瀏覽器不支援 permissions API
        }
      }
    };
    checkMicPermission();
  }, []);

  // 清理資源
  const cleanup = useCallback(() => {
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
    pcmBufferRef.current = [];
  }, []);

  // 开始录音（使用 ScriptProcessor 直接錄製 PCM，避免 webm 解碼問題）
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // 检查 Sherpa 是否就绪
      if (!modelStatus.isReady) {
        if (modelStatus.isLoading) {
          throw new Error('語音識別服務正在啟動中，請稍候...');
        } else if (modelStatus.error) {
          throw new Error('語音識別服務未就緒，請檢查配置');
        } else {
          throw new Error('正在準備語音識別服務，請稍候...');
        }
      }

      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持录音功能');
      }

      // ⚡ 立即設定錄音狀態，讓 UI 馬上反應
      if (micPermissionRef.current === 'granted') {
        setIsRecording(true);
      }

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 更新狀態
      if (micPermissionRef.current !== 'granted') {
        micPermissionRef.current = 'granted';
        setIsRecording(true);
      }

      streamRef.current = stream;
      pcmBufferRef.current = [];

      // 記錄實際使用的麥克風裝置（協助確認收音來源）
      try {
        const micTrack = stream.getAudioTracks()[0];
        const micSettings = micTrack?.getSettings?.() || {};
        if (window.electronAPI && window.electronAPI.log) {
          window.electronAPI.log('info', '🎤 使用麥克風:', {
            label: micTrack?.label,
            deviceId: micSettings.deviceId,
            sampleRate: micSettings.sampleRate,
            channelCount: micSettings.channelCount,
            noiseSuppression: micSettings.noiseSuppression,
            autoGainControl: micSettings.autoGainControl,
            echoCancellation: micSettings.echoCancellation,
          });
        }
      } catch (logErr) {
        // 記錄失敗不影響錄音
      }

      // 創建 AudioContext（使用預設採樣率，讓瀏覽器自動處理）
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      // 確保 AudioContext 是活躍的
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // 創建音源節點
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 創建 ScriptProcessor 來獲取原始 PCM 數據
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // 複製數據到緩衝區
        pcmBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (err) {
      setError(`无法开始录音: ${err.message}`);
      setIsRecording(false);
      cleanup();
    }
  }, [modelStatus.isReady, modelStatus.isLoading, modelStatus.error, cleanup]);

  // 停止录音
  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    setIsRecording(false);
    setIsProcessing(true);

    try {
      // 檢查是否有錄音數據
      if (pcmBufferRef.current.length === 0) {
        throw new Error('錄音數據為空，請重新錄音');
      }

      // 獲取原始採樣率
      const sourceSampleRate = audioContextRef.current?.sampleRate || 48000;

      // 合併所有 PCM 數據
      const totalLength = pcmBufferRef.current.reduce((sum, arr) => sum + arr.length, 0);

      if (totalLength < 1600) { // 小於 0.1 秒的錄音
        throw new Error('錄音時間太短，請說話後再停止錄音');
      }

      const mergedBuffer = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of pcmBufferRef.current) {
        mergedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // 清理資源
      cleanup();

      // 直接轉換為 WAV（重採樣到 16kHz）
      const wavBuffer = pcmToWav(mergedBuffer, sourceSampleRate, 16000);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      setAudioData(wavBlob);

      // 處理音頻
      await processAudio(wavBlob);
    } catch (err) {
      setError(`音频处理失败: ${err.message}`);
      cleanup();
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, cleanup]);

  // 处理音频（接收已經是 WAV 格式的 blob）
  const processAudio = useCallback(async (wavBlob) => {
    processingRef.current.isProcessingAudio = true;

    try {
      if (window.electronAPI) {
        const arrayBuffer = await wavBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const transcriptionResult = await window.electronAPI.transcribeAudio(uint8Array);

        if (transcriptionResult.success) {
          let raw_text = transcriptionResult.text;

          // 检查是否需要转换为繁体中文
          const targetLang = await window.electronAPI.getSetting('language', 'zh-TW');
          const shouldConvert = await window.electronAPI.getSetting('convert_transcription', true);

          if (shouldConvert && targetLang === 'zh-TW') {
            raw_text = convertText(raw_text, 'zh-TW');
          }

          // 套用字典替換（校正專有名詞）
          try {
            const dictResult = await window.electronAPI.applyDictionary(raw_text);
            if (dictResult && dictResult !== raw_text) {
              raw_text = dictResult;
            }
          } catch (dictErr) {
            // 字典替換失敗不影響主流程
            console.warn('字典替換失敗:', dictErr);
          }

          // 准备转录数据
          const transcriptionData = {
            raw_text: raw_text,
            text: raw_text, // 初始文本设为原始文本
            confidence: transcriptionResult.confidence || 0,
            language: targetLang,
            duration: transcriptionResult.duration || 0,
            file_size: uint8Array.length,
            audio_path: transcriptionResult.audio_path || null, // 音訊檔案路徑
          };

          // 立即显示初步结果（已转换）
          if (window.onTranscriptionComplete) {
            window.onTranscriptionComplete({ ...transcriptionResult, text: raw_text, enhanced_by_ai: false });
          }

          // 异步处理AI优化和保存（只保存一次）
          setIsOptimizing(true);
          setTimeout(async () => {
            try {
              // 从设置中读取是否启用AI优化（默认关闭）
              const useAI = await window.electronAPI.getSetting('enable_ai_optimization', false);

              let finalData = { ...transcriptionData };

              if (useAI) {
                try {
                  if (window.electronAPI && window.electronAPI.log) {
                    window.electronAPI.log('info', '开始AI文本优化:', raw_text.substring(0, 50) + '...');
                  }
                  
                  const result = await window.electronAPI.processText(raw_text, 'optimize');

                  if (result && result.success) {
                    let processed_text = result.text;

                    // AI 輸出也需要繁簡轉換
                    if (shouldConvert && targetLang === 'zh-TW') {
                      processed_text = convertText(processed_text, 'zh-TW');
                    }

                    finalData.processed_text = processed_text;
                    // 如果AI优化后的文本与原始文本不同，则将优化后的文本作为主文本
                    if (processed_text && processed_text.trim() !== raw_text.trim()) {
                      finalData.text = processed_text;
                    }
                    if (window.electronAPI && window.electronAPI.log) {
                      window.electronAPI.log('info', 'AI文本优化成功', processed_text.substring(0, 50) + '...');
                    }
                  } else {
                    if (window.electronAPI && window.electronAPI.log) {
                      window.electronAPI.log('error', 'AI文本优化失败:', result);
                    }
                  }
                } catch (err) {
                  if (window.electronAPI && window.electronAPI.log) {
                    window.electronAPI.log('error', 'AI文本优化捕获到错误:', err);
                  }
                }
              }

              // 保存转录数据（只保存一次）
              if (window.electronAPI) {
                if (window.electronAPI && window.electronAPI.log) {
                  window.electronAPI.log('info', '准备保存转录数据:', finalData);
                }
                const savedResult = await window.electronAPI.saveTranscription(finalData);
                if (window.electronAPI && window.electronAPI.log) {
                  window.electronAPI.log('info', '转录数据保存成功:', savedResult);
                }

                // 通知UI更新并触发复制操作
                if (useAI && finalData.processed_text && finalData.processed_text !== raw_text) {
                  // 有AI优化结果时
                  const enhancedResult = {
                    ...transcriptionResult,
                    text: finalData.processed_text,
                    processed_text: finalData.processed_text,
                    enhanced_by_ai: true,
                  };
                  if (window.onAIOptimizationComplete) {
                    window.onAIOptimizationComplete(enhancedResult);
                  }
                } else {
                  // 没有AI优化或AI优化失败时，使用原始文本
                  const finalResult = {
                    ...transcriptionResult,
                    text: raw_text,
                    enhanced_by_ai: false,
                  };
                  if (window.onAIOptimizationComplete) {
                    window.onAIOptimizationComplete(finalResult);
                  }
                }
              }
            } catch (err) {
              if (window.electronAPI && window.electronAPI.log) {
                window.electronAPI.log('error', '处理和保存转录时出错:', err);
              }
            } finally {
              setIsOptimizing(false);
            }
          }, 100);

          return { ...transcriptionResult, enhanced_by_ai: false };
        } else {
          throw new Error(transcriptionResult.error || '语音识别失败');
        }
      } else {
        // Web环境模拟
        const mockResult = { success: true, text: '模拟识别结果。', confidence: 0.95, duration: 3.5 };
        if (window.onTranscriptionComplete) window.onTranscriptionComplete(mockResult);
        return mockResult;
      }
    } catch (err) {
      throw new Error(`音频处理失败: ${err.message}`);
    } finally {
      processingRef.current.isProcessingAudio = false;
    }
  }, []);

  // PCM 數據直接轉 WAV（帶重採樣）- 不需要 decodeAudioData
  // 2 階 Butterworth 低通濾波（biquad），用於降採樣前的抗鋸齒處理
  const lowPassFilter = (data, sampleRate, cutoff) => {
    const w0 = (2 * Math.PI * cutoff) / sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const Q = Math.SQRT1_2; // 0.707，最大平坦響應
    const alpha = sinw0 / (2 * Q);
    const a0 = 1 + alpha;
    const b0 = ((1 - cosw0) / 2) / a0;
    const b1 = (1 - cosw0) / a0;
    const b2 = ((1 - cosw0) / 2) / a0;
    const a1 = (-2 * cosw0) / a0;
    const a2 = (1 - alpha) / a0;

    const out = new Float32Array(data.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < data.length; i++) {
      const x0 = data[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      out[i] = y0;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    }
    return out;
  };

  const pcmToWav = (pcmData, sourceSampleRate, targetSampleRate) => {
    const sourceLength = pcmData.length;

    // 降採樣前先做抗鋸齒低通濾波，避免高頻混疊（aliasing）降低辨識準確度
    // 截止頻率設為目標 Nyquist 的 90%（16kHz → 約 7.2kHz）
    let filteredData = pcmData;
    if (sourceSampleRate > targetSampleRate) {
      const cutoff = (targetSampleRate / 2) * 0.9;
      filteredData = lowPassFilter(pcmData, sourceSampleRate, cutoff);
    }

    // 計算重採樣後的長度
    const resampleRatio = targetSampleRate / sourceSampleRate;
    const targetLength = Math.round(sourceLength * resampleRatio);

    // 線性插值重採樣
    const resampledData = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = i / resampleRatio;
      const index0 = Math.floor(sourceIndex);
      const index1 = Math.min(index0 + 1, sourceLength - 1);
      const fraction = sourceIndex - index0;
      resampledData[i] = filteredData[index0] * (1 - fraction) + filteredData[index1] * fraction;
    }

    const bytesPerSample = 2;
    const numberOfChannels = 1;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = targetSampleRate * blockAlign;
    const dataSize = targetLength * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // WAV 文件頭
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // 音頻數據
    let offset = 44;
    for (let i = 0; i < targetLength; i++) {
      const sample = Math.max(-1, Math.min(1, resampledData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  };

  // 取消录音
  const cancelRecording = useCallback(() => {
    cleanup();
    setIsRecording(false);
    setIsProcessing(false);
    setError(null);
  }, [cleanup]);

  // 获取录音权限状态
  const checkPermissions = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      return result.state; // 'granted', 'denied', 'prompt'
    } catch (err) {
      if (window.electronAPI && window.electronAPI.log) {
        window.electronAPI.log('warn', '无法检查麦克风权限:', err);
      }
      return 'unknown';
    }
  }, []);


  return {
    isRecording,
    isProcessing,
    isOptimizing,
    error,
    audioData,
    startRecording,
    stopRecording,
    cancelRecording,
    checkPermissions
  };
};