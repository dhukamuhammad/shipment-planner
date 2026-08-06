import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import MainRoute from './routes'
import Login from './pages/auth/Login'
import ProtectedRoute from './components/layout/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <MainRoute />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default App
