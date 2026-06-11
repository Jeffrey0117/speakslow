import { Link } from 'react-router-dom'
import { Mic, Users, Github, Download } from 'lucide-react'

const REPO = 'https://github.com/Jeffrey0117/speakslow'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          {/* Title */}
          <h1 className="font-title text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-2">
            聲聲慢
          </h1>
          <p className="text-lg text-gray-400 dark:text-gray-500 mb-5">SpeakSlow</p>

          <p className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            給開發者的中文語音輸入
          </p>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-9">
            對著 Cursor / Claude Code 講中文 — <strong>本地、免費、隱私</strong>
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-900 hover:bg-black text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <Github className="w-5 h-5" /> 在 GitHub 上 Star ⭐
            </a>
            <a
              href={`${REPO}/releases`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <Download className="w-5 h-5" /> 下載 Windows 版
            </a>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <FeatureCard icon="⚡" title="極速" desc="講完約 0.3 秒貼上" />
            <FeatureCard icon="🔒" title="隱私" desc="100% 本地、不上雲" />
            <FeatureCard icon="🆓" title="免費開源" desc="Apache 2.0" />
            <FeatureCard icon="🈶" title="中文優化" desc="專為中文打造" />
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
            免費開源的 <strong>Wispr Flow</strong> 替代方案 ·
            比 Windows 內建更私密（本地非雲端）、還能接 AI 潤飾
          </p>

          {/* Secondary: online demo (needs local backend) */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              線上 Demo（需在本機執行後端）
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/voice" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
                <Mic className="w-4 h-4" /> 語音輸入
              </Link>
              <Link to="/dual" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
                <Users className="w-4 h-4" /> 雙向顯示
              </Link>
            </div>
          </div>
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

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-medium text-gray-900 dark:text-white">{title}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{desc}</div>
    </div>
  )
}
