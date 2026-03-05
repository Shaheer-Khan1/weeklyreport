import styles from './Header.module.css'
import { API_BASE } from '../apiBase'
import WakeButton from './WakeButton'

export default function Header({ auth, onAuthChange, showToast }) {
  async function handleClick() {
    if (auth.connected) {
      if (!confirm('Disconnect your Gmail account?')) return
      await fetch(`${API_BASE}/auth/disconnect`, { method: 'POST' })
      onAuthChange()
      showToast('Gmail disconnected', 'info')
    } else {
      try {
        const res  = await fetch(`${API_BASE}/login`)
        const data = await res.json()
        if (data.url) window.location.href = data.url
        else showToast(data.detail || 'Failed to get login URL', 'error')
      } catch {
        showToast('Cannot reach backend. Is it running?', 'error')
      }
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>📬</div>
        <h1 className={styles.logoText}>Weekly<span>Report</span></h1>
      </div>

      <div className={styles.actions}>
        <WakeButton />
        <button className={styles.pill} onClick={handleClick}>
          <span className={`${styles.dot} ${auth.connected ? styles.connected : ''}`} />
          <span className={styles.label}>{auth.connected ? 'Connected' : 'Connect Gmail'}</span>
          {auth.email && <span className={styles.email}>({auth.email})</span>}
        </button>
      </div>
    </header>
  )
}
