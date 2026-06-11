import { useState, useCallback, useRef, useEffect } from 'react'
import { WS_BASE_URL } from './useApi'

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

interface UseWebSocketReturn {
  connectionState: ConnectionState
  isConnected: boolean
  sessionId: string | null
  streamingAvailable: boolean
  partialText: string
  finalText: string
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  startRecording: () => void
  stopRecording: () => void
  sendAudio: (audioData: ArrayBuffer) => void
  clearText: () => void
}

export function useWebSocket(): UseWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [streamingAvailable, setStreamingAvailable] = useState(false)
  const [partialText, setPartialText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const connect = useCallback((): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      clearReconnectTimeout()
      setConnectionState('connecting')
      setError(null)

      let settled = false
      const settleTimeout = window.setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new Error('連接超時'))
        }
      }, 5000)

      try {
        const ws = new WebSocket(`${WS_BASE_URL}/ws/stream`)

        ws.onopen = () => {
          console.log('WebSocket connected')
          setConnectionState('connected')
          if (!settled) {
            settled = true
            clearTimeout(settleTimeout)
            resolve()
          }
        }

        ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'ready':
              setSessionId(message.session_id)
              setStreamingAvailable(message.streaming_available)
              break

            case 'started':
              console.log('Recording started, mode:', message.mode)
              break

            case 'partial':
              setPartialText(message.text || '')
              break

            case 'final':
              setFinalText(prev => {
                const newText = message.text || ''
                return prev ? `${prev}\n${newText}` : newText
              })
              setPartialText('')
              break

            case 'error':
              setError(message.message)
              break

            case 'pong':
            case 'heartbeat':
              // 心跳響應，不處理
              break

            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

        ws.onerror = (event) => {
          console.error('WebSocket error:', event)
          setConnectionState('error')
          setError('連接錯誤')
          if (!settled) {
            settled = true
            clearTimeout(settleTimeout)
            reject(new Error('連接錯誤'))
          }
        }

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          setConnectionState('disconnected')
          setSessionId(null)

          // 非正常關閉時嘗試重連
          if (event.code !== 1000) {
            reconnectTimeoutRef.current = window.setTimeout(() => {
              console.log('Attempting to reconnect...')
              connect().catch(() => { /* 重連失敗，等下次 */ })
            }, 3000)
          }
        }

        wsRef.current = ws
      } catch (e) {
        console.error('Failed to create WebSocket:', e)
        setConnectionState('error')
        setError('無法建立連接')
        if (!settled) {
          settled = true
          clearTimeout(settleTimeout)
          reject(e as Error)
        }
      }
    })
  }, [clearReconnectTimeout])

  const disconnect = useCallback(() => {
    clearReconnectTimeout()

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect')
      wsRef.current = null
    }

    setConnectionState('disconnected')
    setSessionId(null)
  }, [clearReconnectTimeout])

  const startRecording = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start' }))
      setPartialText('')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
    }
  }, [])

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // 將 ArrayBuffer 轉換為 Base64
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(audioData))
      )

      wsRef.current.send(JSON.stringify({
        type: 'audio',
        data: base64
      }))
    }
  }, [])

  const clearText = useCallback(() => {
    setPartialText('')
    setFinalText('')
  }, [])

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      clearReconnectTimeout()
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount')
      }
    }
  }, [clearReconnectTimeout])

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    sessionId,
    streamingAvailable,
    partialText,
    finalText,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendAudio,
    clearText,
  }
}
