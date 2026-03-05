import { useState, useEffect } from 'react'
import { API_BASE } from '../apiBase'
import styles from './WakeButton.module.css'

const STATUSES = {
  unknown:  { label: 'Wake backend',     icon: '⚡', cls: '' },
  pinging:  { label: 'Waking up…',       icon: '⏳', cls: styles.pinging },
  awake:    { label: 'Backend is awake', icon: '✅', cls: styles.awake },
  error:    { label: 'Failed to reach',  icon: '❌', cls: styles.error },
}

export default function WakeButton() {
  const [status, setStatus]   = useState('unknown')
  const [elapsed, setElapsed] = useState(null)

  async function ping() {
    if (status === 'pinging') return
    setStatus('pinging')
    setElapsed(null)
    const t0 = Date.now()

    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error('non-200')
      setElapsed(((Date.now() - t0) / 1000).toFixed(1))
      setStatus('awake')
      // reset to unknown after 10s so user can ping again
      setTimeout(() => { setStatus('unknown'); setElapsed(null) }, 10_000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('unknown'), 5_000)
    }
  }

  // auto-ping on mount so user sees backend status immediately
  useEffect(() => { ping() }, [])

  const s = STATUSES[status]

  return (
    <button
      className={`${styles.btn} ${s.cls}`}
      onClick={ping}
      disabled={status === 'pinging'}
      title="Render free tier sleeps after inactivity — click to wake it up"
    >
      <span className={status === 'pinging' ? styles.spin : ''}>{s.icon}</span>
      {s.label}
      {status === 'awake' && elapsed && <span className={styles.ms}>({elapsed}s)</span>}
    </button>
  )
}
