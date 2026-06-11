import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mic, MicOff, ArrowLeft, Copy, Trash2, Loader2, Wifi, WifiOff } from 'lucide-react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { transcribeFile, checkHealth } from '../hooks/useApi'

type RecordingState = 'idle' | 'recording' | 'processing'

// 把累積的 16kHz / Int16 / mono PCM 片段組成 WAV Blob
function pcmToWav(chunks: Int16Array[], sampleRate = 16000): Blob {
  let total = 0
  for (const c of chunks) total += c.length
  const pcm = new Int16Array(total)
  let off = 0
  for (const c of chunks) { pcm.set(c, off); off += c.length }

  const dataBytes = pcm.length * 2
  const buf = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buf)
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, dataBytes, true)
  let p = 44
  for (let i = 0; i < pcm.length; i++, p += 2) view.setInt16(p, pcm[i], true)
  return new Blob([buf], { type: 'audio/wav' })
}

export default function VoicePage() {
  const [state, setState] = useState<RecordingState>('idle')
  const [text, setText] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [backendOk, setBackendOk] = useState(false)
  const chunksRef = useRef<Int16Array[]>([])

  const {
    volumeLevel,
    error: recorderError,
    startRecording,
    stopRecording,
    onAudioData,
  } = useAudioRecorder()

  // 累積 PCM 片段（複製一份，避免 buffer 被重用）
  useEffect(() => {
    onAudioData((bufData) => {
      chunksRef.current.push(new Int16Array(bufData.slice(0)))
    })
  }, [onAudioData])

  // 開機檢查後端
  useEffect(() => {
    checkHealth().then(setBackendOk).catch(() => setBackendOk(false))
  }, [])

  const error = apiError || recorderError
  const displayText = text

  const handleMicClick = useCallback(async () => {
    if (state === 'recording') {
      // 停止 → 組 WAV → 送離線辨識
      setState('processing')
      stopRecording()
      await new Promise((r) => setTimeout(r, 150)) // 等最後一塊音訊
      const chunks = chunksRef.current
      chunksRef.current = []
      try {
        if (chunks.length === 0) { setState('idle'); return }
        const wav = pcmToWav(chunks)
        const res = await transcribeFile(wav)
        if (res.success && res.text) {
          setText((prev) => (prev ? prev + '\n' : '') + res.text)
        } else if (!res.success) {
          setApiError(res.error || '辨識失敗')
        }
      } catch {
        setApiError('無法連接後端，請確認 sherpa_web_server 已啟動於 :8765')
      } finally {
        setState('idle')
      }
    } else if (state === 'idle') {
      // 開始錄音
      setApiError(null)
      chunksRef.current = []
      try {
        await startRecording()
        setState('recording')
      } catch {
        setState('idle')
      }
    }
  }, [state, startRecording, stopRecording])

  const handleCopy = useCallback(() => { if (text) navigator.clipboard.writeText(text) }, [text])
  const handleClear = useCallback(() => setText(''), [])

  const BackendIndicator = () => (
    <div className={`flex items-center gap-1 text-xs ${backendOk ? 'text-green-500' : 'text-gray-400'}`}>
      {backendOk ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>{backendOk ? '後端就緒' : '後端未啟動'}</span>
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
        <BackendIndicator />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 min-h-[200px] relative">
            {displayText ? (
              <>
                <p className="font-content text-lg text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {displayText}
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
                {state === 'recording' && '正在聆聽...'}
                {state === 'processing' && '辨識中...'}
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
          disabled={state === 'processing'}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all relative
            ${state === 'idle'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : state === 'recording'
              ? 'bg-red-500 text-white recording-pulse recording-glow'
              : 'bg-gray-400 text-white cursor-not-allowed'}`}
        >
          {state === 'processing' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : state === 'recording' ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {state === 'idle' && '點擊開始錄音'}
          {state === 'recording' && '點擊停止並辨識'}
          {state === 'processing' && '正在辨識...'}
        </p>
      </main>

      <footer className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">
        <p>離線辨識 · 與桌面版相同引擎（去口吃、自動標點）</p>
      </footer>
    </div>
  )
}
