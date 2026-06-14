import { Github, Download, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import screenshot from '../assets/screenshot.png'
import Nav from '../components/Nav'

const REPO = 'https://github.com/Jeffrey0117/SpeakSlow'
// 一鍵直接下載最新版 exe（不丟到 Releases 頁讓人猜要點哪個檔）
const DOWNLOAD = `${REPO}/releases/download/v1.0.7/SpeakSlow-Setup-1.0.7.exe`

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Nav />
      <div className="container mx-auto px-4 py-14">
        <div className="text-center max-w-3xl mx-auto">
          {/* Title */}
          <h1 className="font-title text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-2">
            聲聲慢
          </h1>
          <p className="text-lg text-gray-400 dark:text-gray-500 mb-5">SpeakSlow</p>

          <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            讓每一個字，都被聽見
          </p>
          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-200 mb-2">
            專為中文打造、<strong>最快</strong>的本地語音輸入
          </p>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            用講的取代打字，超快、超準。
            <br />
            <strong className="text-emerald-600 dark:text-emerald-400">特別適合用語音跟 AI 對話</strong>，講完馬上送出，小錯字 AI 也讀得懂。
          </p>

          {/* Product screenshot */}
          <div className="mb-8">
            <img
              src={screenshot}
              alt="聲聲慢 SpeakSlow 介面"
              className="mx-auto rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-sm w-full"
            />
          </div>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a
              href={DOWNLOAD}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <Download className="w-5 h-5" /> 下載 Windows 版（免費）
            </a>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-900 hover:bg-black text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <Github className="w-5 h-5" /> 在 GitHub 上 Star ⭐
            </a>
          </div>

          {/* 教學連結 */}
          <div className="mb-8">
            <Link
              to="/guide"
              className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            >
              <BookOpen className="w-4 h-4" /> 看完整使用教學
            </Link>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            想跟 ChatGPT / Claude / Cursor 講很多話？用講的比打字快太多，講完馬上送出。
            <br />
            免費開源、比 Windows 內建更私密（本地非雲端）。
          </p>
        </div>
      </div>

      <footer className="border-t border-gray-200 dark:border-gray-700 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400 dark:text-gray-500">
          <p>
            聲聲慢 SpeakSlow · Apache 2.0 ·{' '}
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:underline">GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
