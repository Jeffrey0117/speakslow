import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Mic, MicOff, ArrowLeft, Copy, Trash2, Loader2 } from 'lucide-react'

type RecordingState = 'idle' | 'recording' | 'processing'

export default function VoicePage() {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleMicClick = useCallback(async () => {
    if (state === 'recording') {
      // Stop recording
      setState('processing')
      // TODO: Stop audio recording and send to server
      setTimeout(() => {
        setState('idle')
      }, 1000)
    } else if (state === 'idle') {
      // Start recording
      setError(null)
      try {
        // TODO: Start audio recording
        setState('recording')
      } catch (err) {
        setError('無法存取麥克風')
        console.error(err)
      }
    }
  }, [state])

  const handleCopy = useCallback(() => {
    if (transcript) {
      navigator.clipboard.writeText(transcript)
    }
  }, [transcript])

  const handleClear = useCallback(() => {
    setTranscript('')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </Link>
        <h1 className="font-title text-xl font-bold text-gray-900 dark:text-white">
          聲聲慢
        </h1>
        <div className="w-20" /> {/* Spacer */}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Transcript Display */}
        <div className="w-full max-w-2xl mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 min-h-[200px] relative">
            {transcript ? (
              <>
                <p className="font-content text-lg text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {transcript}
                </p>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="複製"
                  >
                    <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={handleClear}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="清除"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-center">
                {state === 'idle' && '點擊麥克風開始錄音'}
                {state === 'recording' && '正在聆聽...'}
                {state === 'processing' && '處理中...'}
              </p>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Microphone Button */}
        <button
          onClick={handleMicClick}
          disabled={state === 'processing'}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center transition-all
            ${state === 'idle'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : state === 'recording'
              ? 'bg-red-500 text-white recording-pulse recording-glow'
              : 'bg-gray-400 text-white cursor-not-allowed'
            }
          `}
        >
          {state === 'processing' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : state === 'recording' ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>

        {/* Status Text */}
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {state === 'idle' && '點擊開始錄音'}
          {state === 'recording' && '點擊停止錄音'}
          {state === 'processing' && '正在辨識...'}
        </p>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">
        網頁版功能開發中，完整功能請使用桌面版
      </footer>
    </div>
  )
}
