import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Mic, MicOff, ArrowLeft, Trash2, Loader2, Maximize2 } from 'lucide-react'

type RecordingState = 'idle' | 'recording' | 'processing'

export default function DualDisplayPage() {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleMicClick = useCallback(async () => {
    if (state === 'recording') {
      setState('processing')
      // TODO: Stop recording
      setTimeout(() => {
        setState('idle')
      }, 1000)
    } else if (state === 'idle') {
      // TODO: Start recording
      setState('recording')
    }
  }, [state])

  const handleClear = useCallback(() => {
    setTranscript('')
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header - hide in fullscreen */}
      {!isFullscreen && (
        <header className="p-3 flex items-center justify-between border-b border-gray-700 bg-gray-800">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </Link>
          <h1 className="font-title text-lg font-bold text-white">
            雙向顯示模式
          </h1>
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="全螢幕"
          >
            <Maximize2 className="w-4 h-4 text-gray-400" />
          </button>
        </header>
      )}

      {/* Top Half - Flipped for person across */}
      <div className="flex-1 flex items-center justify-center p-6 border-b border-gray-700">
        <div className="text-flipped w-full max-w-4xl">
          <p className="font-content text-2xl md:text-3xl text-white leading-relaxed text-center">
            {transcript || (
              <span className="text-gray-500">
                {state === 'idle' && '等待錄音...'}
                {state === 'recording' && '正在聆聽...'}
                {state === 'processing' && '處理中...'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Bottom Half - Normal for self */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <p className="font-content text-2xl md:text-3xl text-white leading-relaxed text-center">
            {transcript || (
              <span className="text-gray-500">
                {state === 'idle' && '等待錄音...'}
                {state === 'recording' && '正在聆聽...'}
                {state === 'processing' && '處理中...'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 flex items-center justify-center gap-4 bg-gray-800 border-t border-gray-700">
        {/* Clear Button */}
        <button
          onClick={handleClear}
          className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
          title="清除"
        >
          <Trash2 className="w-5 h-5 text-gray-300" />
        </button>

        {/* Mic Button */}
        <button
          onClick={handleMicClick}
          disabled={state === 'processing'}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center transition-all
            ${state === 'idle'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : state === 'recording'
              ? 'bg-red-500 text-white recording-pulse recording-glow'
              : 'bg-gray-600 text-white cursor-not-allowed'
            }
          `}
        >
          {state === 'processing' ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : state === 'recording' ? (
            <MicOff className="w-7 h-7" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>

        {/* Fullscreen Button (visible in fullscreen) */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            title="退出全螢幕"
          >
            <Maximize2 className="w-5 h-5 text-gray-300" />
          </button>
        )}
      </div>
    </div>
  )
}
