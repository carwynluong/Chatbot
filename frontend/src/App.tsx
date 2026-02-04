import { Route, Routes, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import { useAuth } from './api/apiUserGenAI'
import Register from './pages/Register'
import ChatInterface from './pages/Chat'
import UploadPage from './pages/Uploads'
import { useEffect } from 'react'

function App() {
  const { isAuthenticated, checkAuth } = useAuth()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])
  
  return (
    <>
      <Routes>
        <Route path='/login' element={!isAuthenticated ? <Login /> : <Navigate to="/chat" />} />
        <Route path='/register' element={!isAuthenticated ? <Register /> : <Navigate to="/login" />} />
        <Route path='/chat' element={isAuthenticated ? <ChatInterface /> : <Navigate to="/login" />} />
        <Route path='/upload' element={isAuthenticated ? <UploadPage /> : <Navigate to="/login" />} />
        <Route path='/' element={<Navigate to={isAuthenticated ? "/chat" : "/login"} />} />
      </Routes>
      <Toaster position='top-right' />
    </>
  )
}

export default App
