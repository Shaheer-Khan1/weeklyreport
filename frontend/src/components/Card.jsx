import styles from './Card.module.css'

export default function Card({ step, title, children }) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>
        <span className={styles.badge}>{step}</span>
        {title}
      </div>
      {children}
    </div>
  )
}
