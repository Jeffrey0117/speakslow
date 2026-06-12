import { Link, useLocation } from 'react-router-dom'

const LINKS = [
  { to: '/', label: '首頁' },
  { to: '/why', label: '為什麼免費' },
  { to: '/compare', label: '工具比較' },
  { to: '/story', label: '開發故事' },
]

export default function Nav() {
  const { pathname } = useLocation()
  return (
    <nav className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
          <img src="/speakslow/favicon.png" alt="" className="w-7 h-7 rounded-lg" />
          聲聲慢
        </Link>
        <div className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === l.to
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/Jeffrey0117/speakslow"
            target="_blank"
            rel="noreferrer"
            className="ml-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  )
}
