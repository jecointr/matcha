import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Data router (createBrowserRouter) so route-level navigation blocking
// (useBlocker, used to guard unsaved profile edits) is available. App keeps
// defining its routes with <Routes> as a descendant of this splat route — no
// other structural change.
const router = createBrowserRouter([
  { path: '*', element: <App /> }
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
