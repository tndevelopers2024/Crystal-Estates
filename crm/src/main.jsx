import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DialogProvider } from './context/DialogContext'
import App from './App.jsx'
import './index.css'
import { installAuthFetch } from './lib/authFetch'

// Every request to the CRM API carries the session token (before anything renders)
installAuthFetch()

// Remount the app when the session changes so data loads with the new user's token
function SessionApp() {
  const { token } = useAuth()
  return <App key={token || 'signed-out'} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DialogProvider>
          <SessionApp />
        </DialogProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

