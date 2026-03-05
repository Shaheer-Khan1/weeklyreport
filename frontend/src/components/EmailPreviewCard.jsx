import { useState } from 'react'
import Card from './Card'
import styles from './EmailPreviewCard.module.css'

export default function EmailPreviewCard({ draft, onChange, onReset, showToast, connected }) {
  const [sending, setSending] = useState(false)

  function update(field, value) {
    onChange({ ...draft, [field]: value })
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
      const res = await fetch('/send-email', {
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
        <input type="email" value={draft.to} onChange={e => update('to', e.target.value)} placeholder="recipient@example.com" />
      </div>
      <div className={styles.field}>
        <label>CC <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <input type="text" value={draft.cc || ''} onChange={e => update('cc', e.target.value)} placeholder="cc@example.com, another@example.com" />
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
