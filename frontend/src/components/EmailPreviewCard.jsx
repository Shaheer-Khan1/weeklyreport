import { useState } from 'react'
import Card from './Card'
import styles from './EmailPreviewCard.module.css'
import { API_BASE } from '../apiBase'

const TO_SUGGESTIONS = [
  'haitham@smarttive.com',
]

const CC_SUGGESTIONS = [
  'abdullah.khan@smarttive.com',
  'shaheer.khan@smarttive.com',
  'mishal.ahmed@smarttive.com',
  'saif.khan@smarttive.com',
]

export default function EmailPreviewCard({ draft, onChange, onReset, showToast, connected }) {
  const [sending, setSending] = useState(false)

  function update(field, value) {
    onChange({ ...draft, [field]: value })
  }

  function selectTo(email) {
    update('to', email)
  }

  function toggleCc(email) {
    const current = (draft.cc || '').split(',').map(e => e.trim()).filter(Boolean)
    const exists  = current.includes(email)
    const updated = exists ? current.filter(e => e !== email) : [...current, email]
    update('cc', updated.join(', '))
  }

  function isCcSelected(email) {
    return (draft.cc || '').split(',').map(e => e.trim()).includes(email)
  }

  async function send() {
    if (!draft.to)      { showToast('Please enter a recipient.', 'error');  return }
    if (!draft.subject) { showToast('Please enter a subject.', 'error');    return }
    if (!draft.body)    { showToast('Email body cannot be empty.', 'error'); return }
    if (!connected)     { showToast('Please connect Gmail first.', 'error'); return }

    setSending(true)
    const payload = { to: draft.to, cc: draft.cc || '', subject: draft.subject, body: draft.body }
    console.log('[send]', payload)
    try {
      const res = await fetch(`${API_BASE}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      showToast('Email sent!', 'success')
      setTimeout(onReset, 1800)
    } catch (e) {
      showToast('Send failed: ' + e.message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card step={3} title="Preview & Send">
      <div className={styles.field}>
        <label>To</label>
        <div className={styles.chips}>
          {TO_SUGGESTIONS.map(email => (
            <button
              key={email}
              type="button"
              className={`${styles.chip} ${draft.to === email ? styles.chipActive : ''}`}
              onClick={() => selectTo(email)}
            >
              {email}
            </button>
          ))}
        </div>
        <input type="email" value={draft.to} onChange={e => update('to', e.target.value)} placeholder="recipient@example.com" />
      </div>
      <div className={styles.field}>
        <label>CC <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — click to add)</span></label>
        <div className={styles.chips}>
          {CC_SUGGESTIONS.map(email => (
            <button
              key={email}
              type="button"
              className={`${styles.chip} ${isCcSelected(email) ? styles.chipActive : ''}`}
              onClick={() => toggleCc(email)}
            >
              {isCcSelected(email) && <span className={styles.chipCheck}>✓ </span>}
              {email}
            </button>
          ))}
        </div>
        <input type="text" value={draft.cc || ''} onChange={e => update('cc', e.target.value)} placeholder="or type manually: cc@example.com, another@example.com" />
      </div>
      <div className={styles.field}>
        <label>Subject</label>
        <input type="text" value={draft.subject} onChange={e => update('subject', e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>Body</label>
        <textarea value={draft.body} onChange={e => update('body', e.target.value)} />
      </div>

      <div className={styles.actions}>
        <button className={styles.back} onClick={onReset}>← Start Over</button>
        <button className={styles.send} onClick={send} disabled={sending}>
          {sending ? <><span className={styles.spinner} /> Sending…</> : 'Send Email'}
        </button>
      </div>
    </Card>
  )
}
