import { useState, useRef } from 'react'
import Card from './Card'
import styles from './RecordCard.module.css'

export default function RecordCard({ onTranscriptUpdate, showToast }) {
  const [state, setState]     = useState('idle')   // idle | recording | transcribing
  const [seconds, setSeconds] = useState(0)
  const [context, setContext] = useState('')

  const mediaRecorder  = useRef(null)
  const audioChunks    = useRef([])
  const timerRef       = useRef(null)

  async function toggleRecording() {
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle') {
      await startRecording()
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current  = new MediaRecorder(stream)
      audioChunks.current    = []

      mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data)
      mediaRecorder.current.onstop = () => handleStop(context)
      mediaRecorder.current.start()

      setState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      showToast('Microphone access denied.', 'error')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    mediaRecorder.current?.stop()
    mediaRecorder.current?.stream.getTracks().forEach(t => t.stop())
    setState('transcribing')
    onTranscriptUpdate('')
  }

  async function handleStop(ctx) {
    const blob     = new Blob(audioChunks.current, { type: 'audio/webm' })
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')

    try {
      const res = await fetch('/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).detail)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))
          if (payload.error) throw new Error(payload.error)
          if (payload.segment) onTranscriptUpdate(payload.full)
          if (payload.done) {
            onTranscriptUpdate(payload.transcript)
            showToast('Transcription complete', 'success')
          }
        }
      }
    } catch (e) {
      showToast('Transcription failed: ' + e.message, 'error')
      onTranscriptUpdate('')
    } finally {
      setState('idle')
    }
  }

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  return (
    <Card step={1} title="Record Your Voice Note">
      <button
        className={`${styles.btn} ${state === 'recording' ? styles.recording : ''} ${state === 'transcribing' ? styles.transcribing : ''}`}
        onClick={toggleRecording}
        disabled={state === 'transcribing'}
      >
        <span className={styles.mic}>🎙️</span>

        {state === 'recording' && (
          <div className={styles.waveform}>
            {[...Array(5)].map((_, i) => <span key={i} style={{ animationDelay: `${i * .1}s` }} />)}
          </div>
        )}

        <span className={styles.status}>
          {state === 'idle'         && 'Click to start recording'}
          {state === 'recording'    && `Recording… click to stop`}
          {state === 'transcribing' && 'Transcribing…'}
        </span>

        {state === 'recording'    && <span className={styles.timer}>{fmt(seconds)}</span>}
      </button>

      {state === 'transcribing' && <div className={styles.progressBar}><div className={styles.progressFill} /></div>}

      <input
        className={styles.context}
        type="text"
        value={context}
        onChange={e => setContext(e.target.value)}
        placeholder="Optional: add context (e.g. audience, team name, project)"
        disabled={state !== 'idle'}
      />
    </Card>
  )
}
