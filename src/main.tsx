import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Hub from './pages/Hub'
import GamePage from './pages/GamePage'
createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><Routes>
    <Route path="/" element={<Hub />} />
    <Route path="/jeux/:slug" element={<GamePage />} />
    <Route path="*" element={<Hub />} />
  </Routes></BrowserRouter></StrictMode>)
