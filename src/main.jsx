import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Toaster } from './components/ui/sonner'
import { LanguageProvider } from './i18n'

// 检查是否在Electron环境中
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

// 错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    // 在Electron环境中记录错误
    if (isElectron()) {
      window.electronAPI.log('error', `React Error: ${error.message}`)
    } else {
      console.error('React Error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-sm">!</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">应用出现错误</h2>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              聲聲慢遇到了一個意外錯誤。請嘗試重啟應用。
            </p>

            {process.env.NODE_ENV === 'development' && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  查看错误详情
                </summary>
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-32">
                  <div className="mb-2">
                    <strong>错误:</strong> {this.state.error && this.state.error.toString()}
                  </div>
                  <div>
                    <strong>堆栈:</strong>
                    <pre className="whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              </details>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                重新加载
              </button>

              {isElectron() && (
                <button
                  onClick={() => window.electronAPI.closeWindow()}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  关闭应用
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// 应用初始化
function initializeApp() {
  // 检查Electron API是否可用
  if (!isElectron()) {
    console.warn('Electron API不可用，某些功能可能无法正常工作')
  }

  // 设置全局错误处理
  window.addEventListener('error', (event) => {
    if (isElectron()) {
      window.electronAPI.log('error', `Global Error: ${event.error?.message || event.message}`)
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (isElectron()) {
      window.electronAPI.log('error', `Unhandled Promise Rejection: ${event.reason}`)
    }
  })

  // 防止默认的拖拽行为
  document.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })

  document.addEventListener('drop', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })

  // 防止右键菜单（生产环境）
  if (process.env.NODE_ENV === 'production') {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
  }

  // 设置中文语言环境
  document.documentElement.lang = 'zh-CN'
  
  // 添加系统主题检测
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (e.matches) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })
}

// 初始化应用
initializeApp()

// 渲染应用
const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
        <Toaster />
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
)

// 开发环境下的热重载支持
if (process.env.NODE_ENV === 'development') {
  if (import.meta.hot) {
    import.meta.hot.accept('./App.jsx', (newModule) => {
      if (newModule) {
        const NextApp = newModule.default
        root.render(
          <React.StrictMode>
            <ErrorBoundary>
              <LanguageProvider>
                <NextApp />
                <Toaster />
              </LanguageProvider>
            </ErrorBoundary>
          </React.StrictMode>
        )
      }
    })
  }
}

// 性能监控已禁用 - 太吵了