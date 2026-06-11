import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import VoicePage from './pages/VoicePage'
import DualDisplayPage from './pages/DualDisplayPage'
import './index.css'

function App() {
  // HashRouter：GitHub Pages 靜態托管下，子路由 (/voice /dual) 直接重整不會 404
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voice" element={<VoicePage />} />
        <Route path="/dual" element={<DualDisplayPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
