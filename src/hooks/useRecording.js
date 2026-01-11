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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // 添加防重复处理机制
  const processingRef = useRef({ isProcessingAudio: false, lastProcessTime: 0 });

  // 預熱的 AudioContext 用於減少錄音啟動延遲
  const prewarmedAudioContextRef = useRef(null);

  // 錄音用的 AudioContext（保持活躍以減少轉換延遲）
  const recordingAudioContextRef = useRef(null);

  // 麥克風權限狀態快取
  const micPermissionRef = useRef('unknown');

  // 使用模型状态Hook
  const modelStatus = useModelStatus();

  // 預熱 AudioContext 以減少首次錄音延遲
  useEffect(() => {
    const prewarmAudio = async () => {
      try {
        // 創建並預熱 AudioContext
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });

        // 必須在用戶交互後 resume（暫時保持 suspended 狀態）
        prewarmedAudioContextRef.current = audioContext;

        // 預查詢麥克風權限狀態
        if (navigator.permissions) {
          try {
            const result = await navigator.permissions.query({ name: 'microphone' });
            micPermissionRef.current = result.state;

            // 監聽權限變化
            result.onchange = () => {
              micPermissionRef.current = result.state;
            };
          } catch (e) {
            // 某些瀏覽器不支援 permissions API
          }
        }
      } catch (e) {
        // 預熱失敗不影響功能
      }
    };

    prewarmAudio();

    return () => {
      // 清理預熱的 AudioContext
      if (prewarmedAudioContextRef.current) {
        prewarmedAudioContextRef.current.close().catch(() => {});
        prewarmedAudioContextRef.current = null;
      }
      // 清理錄音用的 AudioContext
      if (recordingAudioContextRef.current) {
        recordingAudioContextRef.current.close().catch(() => {});
        recordingAudioContextRef.current = null;
      }
    };
  }, []);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // 检查FunASR是否就绪
      if (!modelStatus.isReady) {
        if (modelStatus.isLoading) {
          throw new Error('FunASR服务器正在启动中，请稍候...');
        } else if (modelStatus.error) {
          throw new Error('FunASR服务器未就绪，请检查配置');
        } else {
          throw new Error('正在准备FunASR服务器，请稍候...');
        }
      }

      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持录音功能');
      }

      // ⚡ 立即設定錄音狀態，讓 UI 馬上反應
      // 如果麥克風權限已授權，可以安全地先顯示錄音中
      if (micPermissionRef.current === 'granted') {
        setIsRecording(true);
      }

      // 请求麦克风权限（這是最慢的步驟）
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 如果之前沒有權限，現在有了，更新狀態
      if (micPermissionRef.current !== 'granted') {
        micPermissionRef.current = 'granted';
        setIsRecording(true);
      }

      streamRef.current = stream;
      audioChunksRef.current = [];

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      // 預先創建 AudioContext 以減少停止錄音後的轉換延遲
      if (!recordingAudioContextRef.current || recordingAudioContextRef.current.state === 'closed') {
        recordingAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
      }

      // 设置事件处理器
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          // 创建音频Blob
          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm;codecs=opus'
          });

          setAudioData(audioBlob);

          // 处理音频
          await processAudio(audioBlob);
        } catch (err) {
          setError(`音频处理失败: ${err.message}`);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.onerror = (event) => {
        setError(`录音错误: ${event.error?.message || '未知错误'}`);
        setIsRecording(false);
        setIsProcessing(false);
      };

      // 开始录音
      mediaRecorder.start(1000); // 每秒收集一次数据

    } catch (err) {
      setError(`无法开始录音: ${err.message}`);
      setIsRecording(false);
    }
  }, [modelStatus.isReady, modelStatus.isLoading, modelStatus.error]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();

      // 停止所有音频轨道
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  // 处理音频
  const processAudio = useCallback(async (audioBlob) => {
    processingRef.current.isProcessingAudio = true;
    
    try {
      const wavBlob = await convertToWav(audioBlob);

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

          // 准备转录数据
          const transcriptionData = {
            raw_text: raw_text,
            text: raw_text, // 初始文本设为原始文本
            confidence: transcriptionResult.confidence || 0,
            language: targetLang,
            duration: transcriptionResult.duration || 0,
            file_size: uint8Array.length,
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
                    const processed_text = result.text;
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

  // 转换音频格式为WAV（使用預先創建的 AudioContext 以減少延遲）
  const convertToWav = useCallback(async (audioBlob) => {
    return new Promise((resolve, reject) => {
      // 檢查音頻數據是否有效
      if (!audioBlob || audioBlob.size === 0) {
        reject(new Error('錄音數據為空，請重新錄音'));
        return;
      }

      // 如果錄音太短（小於 1KB），可能是無效錄音
      if (audioBlob.size < 1000) {
        reject(new Error('錄音時間太短，請說話後再停止錄音'));
        return;
      }

      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result;

          // 創建新的 AudioContext（不使用預熱的，避免 sampleRate 衝突）
          // 使用預設 sampleRate 讓瀏覽器自動處理
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();

          // 確保 AudioContext 是活躍的
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }

          // 解码音频数据（需要複製 arrayBuffer，因為 decodeAudioData 會消耗它）
          let audioBuffer;
          try {
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
          } catch (decodeErr) {
            console.error('音頻解碼失敗，嘗試備用方案:', decodeErr);

            // 備用方案：嘗試用 callback 方式解碼（某些瀏覽器的兼容性更好）
            try {
              audioBuffer = await new Promise((res, rej) => {
                // 重新讀取 blob
                const reader2 = new FileReader();
                reader2.onload = () => {
                  const newContext = new (window.AudioContext || window.webkitAudioContext)();
                  newContext.decodeAudioData(
                    reader2.result,
                    (buffer) => {
                      res(buffer);
                      newContext.close();
                    },
                    (err) => {
                      rej(err);
                      newContext.close();
                    }
                  );
                };
                reader2.onerror = () => rej(new Error('讀取失敗'));
                reader2.readAsArrayBuffer(audioBlob);
              });
            } catch (fallbackErr) {
              console.error('備用解碼也失敗:', fallbackErr);
              audioContext.close();
              reject(new Error('無法解碼音頻數據，請重新錄音。如果問題持續，請嘗試重啟應用程式。'));
              return;
            }
          }

          // 转换为WAV格式（目標 16kHz 單聲道）
          const wavBuffer = audioBufferToWav(audioBuffer, 16000);
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

          audioContext.close();
          resolve(wavBlob);
        } catch (err) {
          reject(new Error(`音频格式转换失败: ${err.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('读取音频文件失败'));
      };

      reader.readAsArrayBuffer(audioBlob);
    });
  }, []);

  // AudioBuffer转WAV格式（支持重採樣到目標採樣率）
  const audioBufferToWav = (audioBuffer, targetSampleRate = 16000) => {
    const sourceSampleRate = audioBuffer.sampleRate;
    const sourceLength = audioBuffer.length;

    // 計算重採樣後的長度
    const resampleRatio = targetSampleRate / sourceSampleRate;
    const targetLength = Math.round(sourceLength * resampleRatio);

    // 只使用第一個聲道（單聲道）
    const sourceData = audioBuffer.getChannelData(0);

    // 線性插值重採樣
    const resampledData = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const sourceIndex = i / resampleRatio;
      const index0 = Math.floor(sourceIndex);
      const index1 = Math.min(index0 + 1, sourceLength - 1);
      const fraction = sourceIndex - index0;
      resampledData[i] = sourceData[index0] * (1 - fraction) + sourceData[index1] * fraction;
    }

    const bytesPerSample = 2;
    const numberOfChannels = 1; // 強制單聲道
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = targetSampleRate * blockAlign;
    const dataSize = targetLength * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // WAV文件头
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

    // 音频数据（使用重採樣後的數據）
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
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsProcessing(false);
    setError(null);
    audioChunksRef.current = [];
  }, []);

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