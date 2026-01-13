import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import VoicePage from './pages/VoicePage'
import DualDisplayPage from './pages/DualDisplayPage'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voice" element={<VoicePage />} />
        <Route path="/dual" element={<DualDisplayPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
