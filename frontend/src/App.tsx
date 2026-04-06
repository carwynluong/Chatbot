import { Route, Routes, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import { useAuth } from './api/apiUserGenAI'
import Register from './pages/Register'
import ChatInterface from './pages/Chat'
import Layout from './components/Layout'
import { useEffect } from 'react'

function App() {
  const { isAuthenticated, checkAuth } = useAuth()

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <>
      <Routes>
        {/* Auth routes without layout */}
        <Route path='/login' element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        <Route path='/register' element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
        
        {/* Protected routes with authentication check */}
        <Route path='/*' element={
          isAuthenticated ? (
            <Layout>
              <Routes>
                <Route path='/' element={<ChatInterface />} />
                <Route path='/chat' element={<Navigate to="/" />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
      <Toaster position='top-right' />
    </>
  )
}

export default App
