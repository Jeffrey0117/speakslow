import { Link } from 'react-router-dom'
import { Mic, Users, Github, Download } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          {/* Logo / Title */}
          <h1 className="font-title text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            聲聲慢
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            SpeakSlow
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
            讓每一個字，都被聽見
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              to="/voice"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <Mic className="w-5 h-5" />
              開始使用
            </Link>
            <Link
              to="/dual"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors shadow-lg border border-gray-200 dark:border-gray-600"
            >
              <Users className="w-5 h-5" />
              雙向顯示模式
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <FeatureCard icon="🎯" title="高準確" desc="離線 AI 辨識" />
            <FeatureCard icon="⚡" title="低延遲" desc="即時串流顯示" />
            <FeatureCard icon="🔒" title="隱私保護" desc="本地處理" />
            <FeatureCard icon="📴" title="離線可用" desc="無需網路" />
          </div>

          {/* Download Links */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              下載桌面版，享受完整功能
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a
                href="#"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                Windows
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                macOS
              </a>
              <a
                href="https://github.com/Jeffrey0117/ququ"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>聲聲慢 SpeakSlow &copy; 2025</p>
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
