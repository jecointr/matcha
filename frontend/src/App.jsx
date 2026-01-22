import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Heart, Bell, MessageCircle, User, LogOut, Menu, X } from 'lucide-react'

// Placeholder pages (to be created in next phases)
const Home = () => (
  <div className="text-center py-20">
    <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Matcha</h1>
    <p className="text-xl text-gray-600 mb-8">Find your perfect match</p>
    <div className="space-x-4">
      <a href="/login" className="btn-primary">Login</a>
      <a href="/register" className="btn-outline">Register</a>
    </div>
  </div>
)

const Login = () => <div className="card max-w-md mx-auto mt-20"><h2 className="text-2xl font-bold">Login</h2><p className="text-gray-500 mt-2">Coming in Phase 2</p></div>
const Register = () => <div className="card max-w-md mx-auto mt-20"><h2 className="text-2xl font-bold">Register</h2><p className="text-gray-500 mt-2">Coming in Phase 2</p></div>
const NotFound = () => <div className="text-center py-20"><h1 className="text-4xl font-bold">404</h1><p className="text-gray-500">Page not found</p></div>

// Header component
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggedIn] = useState(false) // Will be replaced with auth context
  
  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-2">
            <Heart className="h-8 w-8 text-primary-500" fill="currentColor" />
            <span className="text-xl font-bold text-gray-900">Matcha</span>
          </a>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                <a href="/browse" className="text-gray-600 hover:text-gray-900 px-3 py-2">Browse</a>
                <a href="/matches" className="text-gray-600 hover:text-gray-900 px-3 py-2">Matches</a>
                <a href="/chat" className="relative text-gray-600 hover:text-gray-900 p-2">
                  <MessageCircle className="h-6 w-6" />
                  <span className="absolute top-0 right-0 h-4 w-4 bg-primary-500 rounded-full text-xs text-white flex items-center justify-center">3</span>
                </a>
                <a href="/notifications" className="relative text-gray-600 hover:text-gray-900 p-2">
                  <Bell className="h-6 w-6" />
                  <span className="absolute top-0 right-0 h-4 w-4 bg-primary-500 rounded-full text-xs text-white flex items-center justify-center">5</span>
                </a>
                <a href="/profile" className="text-gray-600 hover:text-gray-900 p-2">
                  <User className="h-6 w-6" />
                </a>
                <button className="text-gray-600 hover:text-gray-900 p-2">
                  <LogOut className="h-6 w-6" />
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 hover:text-gray-900 px-3 py-2">Login</a>
                <a href="/register" className="btn-primary">Register</a>
              </>
            )}
          </nav>
          
          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        
        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-2">
              <a href="/login" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded">Login</a>
              <a href="/register" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded">Register</a>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}

// Footer component
const Footer = () => (
  <footer className="bg-white border-t mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center space-x-2 mb-4 md:mb-0">
          <Heart className="h-6 w-6 text-primary-500" fill="currentColor" />
          <span className="font-semibold text-gray-900">Matcha</span>
        </div>
        <div className="flex space-x-6 text-sm text-gray-500">
          <a href="/about" className="hover:text-gray-900">About</a>
          <a href="/privacy" className="hover:text-gray-900">Privacy</a>
          <a href="/terms" className="hover:text-gray-900">Terms</a>
          <a href="/contact" className="hover:text-gray-900">Contact</a>
        </div>
        <p className="text-sm text-gray-500 mt-4 md:mt-0">
          © {new Date().getFullYear()} Matcha. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
)

// Main App
function App() {
  const [apiStatus, setApiStatus] = useState(null)
  
  useEffect(() => {
    // Test API connection
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then(res => res.json())
      .then(data => setApiStatus(data))
      .catch(err => setApiStatus({ status: 'error', error: err.message }))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* API Status indicator (dev only) */}
          {apiStatus && (
            <div className={`mb-4 p-2 rounded text-sm ${apiStatus.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              API: {apiStatus.status} | DB: {apiStatus.database || 'unknown'}
            </div>
          )}
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}

export default App
