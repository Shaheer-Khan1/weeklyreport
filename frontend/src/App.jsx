import { useState, useEffect } from 'react'
import Header from './components/Header'
import Banner from './components/Banner'
import RecordCard from './components/RecordCard'
import TranscriptCard from './components/TranscriptCard'
import EmailPreviewCard from './components/EmailPreviewCard'
import Toast from './components/Toast'
import { API_BASE } from './apiBase'

console.log('[App] module loaded')

export default function App() {
  console.log('[App] rendering')

  const [auth, setAuth]             = useState({ connected: false, email: '' })
  const [transcript, setTranscript] = useState('')
  const [emailDraft, setEmailDraft] = useState(null)
  const [toast, setToast]           = useState(null)

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function fetchAuthStatus() {
    console.log('[App] fetching /auth/status from', API_BASE)
    try {
      const res  = await fetch(`${API_BASE}/auth/status`)
      console.log('[App] /auth/status response:', res.status)
      const data = await res.json()
      console.log('[App] auth data:', data)
      setAuth({ connected: data.connected, email: data.email || '' })
    } catch (e) {
      console.error('[App] /auth/status error:', e)
      setAuth({ connected: false, email: '' })
    }
  }

  useEffect(() => {
    fetchAuthStatus()
    const id = setInterval(fetchAuthStatus, 30_000)
    return () => clearInterval(id)
  }, [])

  // Handle ?connected=true redirect back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      history.replaceState({}, '', '/')
      showToast('Gmail connected!', 'success')
      fetchAuthStatus()
    }
  }, [])

  function handleTranscriptReady(text) {
    setTranscript(text)
  }

  function handleEmailReady(draft) {
    setEmailDraft({ cc: '', ...draft })
  }

  function reset() {
    setTranscript('')
    setEmailDraft(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <Header auth={auth} onAuthChange={fetchAuthStatus} showToast={showToast} />

      <main style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!auth.connected && <Banner onConnect={connectEmail} />}

        <RecordCard
          onTranscriptUpdate={handleTranscriptReady}
          onEmailReady={handleEmailReady}
          showToast={showToast}
        />

        {transcript && (
          <TranscriptCard
            transcript={transcript}
            onTranscriptChange={setTranscript}
            onEmailReady={handleEmailReady}
            showToast={showToast}
          />
        )}

        {emailDraft && (
          <EmailPreviewCard
            draft={emailDraft}
            onChange={setEmailDraft}
            onReset={reset}
            showToast={showToast}
            connected={auth.connected}
          />
        )}
      </main>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}

async function connectEmail() {
  try {
    const res  = await fetch(`${API_BASE}/login`)
    const data = await res.json()
    if (data.url) window.location.href = data.url
  } catch {
    alert('Cannot reach backend. Is it running on port 8000?')
  }
}
