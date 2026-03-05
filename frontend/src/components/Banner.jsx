import styles from './Banner.module.css'

export default function Banner({ onConnect }) {
  return (
    <div className={styles.banner}>
      ⚠️ Gmail not connected —{' '}
      <button className={styles.link} onClick={onConnect}>connect your account</button>
      {' '}to enable sending.
    </div>
  )
}
