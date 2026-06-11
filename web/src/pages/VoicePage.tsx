import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mic, MicOff, ArrowLeft, Copy, Trash2, Loader2, Wifi, WifiOff } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

type RecordingState = 'idle' | 'connecting' | 'recording' | 'processing'

export default function VoicePage() {
  const [state, setState] = useState<RecordingState>('idle')
  const recordingRef = useRef(false) // 給音訊回呼即時讀取（避免 stale closure）

  const {
    isConnected,
    partialText,
    finalText,
    error: wsError,
    connect,
    startRecording: wsStartRecording,
    stopRecording: wsStopRecording,
    sendAudio,
    clearText,
  } = useWebSocket()

  const {
    volumeLevel,
    error: recorderError,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    onAudioData,
  } = useAudioRecorder()

  // 設置音訊回呼：只在錄音中送出（用 ref 即時判斷，sendAudio 內部會檢查連線）
  useEffect(() => {
    onAudioData((data) => {
      if (recordingRef.current) sendAudio(data)
    })
  }, [onAudioData, sendAudio])

  // 即時組合顯示文字（已定稿 + 進行中）
  const displayText = partialText
    ? `${finalText}${finalText ? '\n' : ''}${partialText}`
    : finalText

  const error = wsError || recorderError

  const handleMicClick = useCallback(async () => {
    if (state === 'recording') {
      // 停止：先停音訊回呼，通知伺服器結束，等最終結果
      setState('processing')
      recordingRef.current = false
      stopAudioRecording()
      wsStopRecording()
      setTimeout(() => setState('idle'), 800)
    } else if (state === 'idle') {
      setState('connecting')
      try {
        await connect()              // 連上才往下（已修 stale closure）
        await startAudioRecording()
        wsStartRecording()
        recordingRef.current = true
        setState('recording')
      } catch (err) {
        console.error('開始串流失敗:', err)
        recordingRef.current = false
        setState('idle')
      }
    }
  }, [state, connect, startAudioRecording, stopAudioRecording, wsStartRecording, wsStopRecording])

  const handleCopy = useCallback(() => {
    if (displayText) navigator.clipboard.writeText(displayText)
  }, [displayText])

  const handleClear = useCallback(() => clearText(), [clearText])

  const ConnectionIndicator = () => (
    <div className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-500' : 'text-gray-400'}`}>
      {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>{isConnected ? '已連線（串流）' : '未連線'}</span>
    </div>
  )

  const VolumeIndicator = () => (
    <div className="w-32 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className="h-full bg-green-500 transition-all duration-75" style={{ width: `${volumeLevel * 100}%` }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </Link>
        <h1 className="font-title text-xl font-bold text-gray-900 dark:text-white">聲聲慢</h1>
        <ConnectionIndicator />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 min-h-[200px] relative">
            {displayText ? (
              <>
                <p className="font-content text-lg text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {finalText}
                  {partialText && (
                    <>
                      {finalText && '\n'}
                      <span className="text-gray-400 dark:text-gray-500">{partialText}</span>
                    </>
                  )}
                </p>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={handleCopy} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="複製">
                    <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button onClick={handleClear} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="清除">
                    <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-center">
                {state === 'idle' && '點擊麥克風開始錄音'}
                {state === 'connecting' && '正在連接...'}
                {state === 'recording' && '正在聆聽...'}
                {state === 'processing' && '處理中...'}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {state === 'recording' && (
          <div className="mb-4"><VolumeIndicator /></div>
        )}

        <button
          onClick={handleMicClick}
          disabled={state === 'processing' || state === 'connecting'}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all relative
            ${state === 'idle'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : state === 'recording'
              ? 'bg-red-500 text-white recording-pulse recording-glow'
              : 'bg-gray-400 text-white cursor-not-allowed'}`}
        >
          {state === 'processing' || state === 'connecting' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : state === 'recording' ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {state === 'idle' && '點擊開始錄音'}
          {state === 'connecting' && '正在連接伺服器...'}
          {state === 'recording' && '點擊停止錄音（即時逐字）'}
          {state === 'processing' && '正在辨識...'}
        </p>
      </main>

      <footer className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">
        <p>串流即時辨識 · 與桌面版相同引擎</p>
      </footer>
    </div>
  )
}
