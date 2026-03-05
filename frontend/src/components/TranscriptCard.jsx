import { useState } from 'react'
import Card from './Card'
import styles from './TranscriptCard.module.css'

export default function TranscriptCard({ transcript, onTranscriptChange, onEmailReady, showToast }) {
  const [loading, setLoading] = useState(false)

  async function generateEmail() {
    if (!transcript.trim()) { showToast('Transcript is empty.', 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      const data = await res.json()
      onEmailReady(data)
      showToast('Email draft ready — review before sending', 'success')
    } catch (e) {
      showToast('Generation failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card step={2} title="Review Transcript">
      <textarea
        className={styles.box}
        value={transcript}
        onChange={e => onTranscriptChange(e.target.value)}
        placeholder="Your transcribed voice note will appear here…"
      />
      <div className={styles.divider} />
      <button className={styles.btn} onClick={generateEmail} disabled={loading}>
        {loading ? <><span className={styles.spinner} /> Generating…</> : 'Generate Email Draft'}
      </button>
    </Card>
  )
}
