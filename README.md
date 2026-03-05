# Weekly Report Sender

Turn a voice note into a polished weekly status report email — sent directly from your Gmail account.

**Flow:**
Voice note → Whisper transcription → Gemini email draft → Preview & edit → Send via Gmail API

---

## Setup

### 1. Google Cloud Console — create OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library** → enable **Gmail API**
4. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**, fill in app name & your email
   - Add scope: `https://www.googleapis.com/auth/gmail.send`
   - Add your Gmail address as a **test user**
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:8000/auth/callback`
6. Download the JSON file and save it as **`backend/credentials.json`**

### 2. Get a Gemini API key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create an API key (free tier available)

### 3. Install FFmpeg (required by Whisper)

Download from [ffmpeg.org/download.html](https://ffmpeg.org/download.html) and add it to your PATH.

On Windows with winget:
```
winget install ffmpeg
```

### 4. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 5. Configure environment variables

```bash
cp .env.example .env
```

Edit `backend/.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5500
WHISPER_MODEL=base
```

### 6. Start the backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 7. Open the frontend

Open `frontend/index.html` in a browser (use Live Server in VS Code, or any static file server on port 5500).

---

## Usage

1. Open the app in your browser
2. Click **Connect Gmail** → complete Google login → click Allow
3. Click the microphone button and speak your weekly update
4. Click Stop → transcript appears automatically
5. Click **Generate Email Draft** → Gemini formats it into a professional email
6. Review and edit the To, Subject, and Body fields
7. Click **Send Email** — it sends from your Gmail account

---

## Project Structure

```
WeeklyReportSender/
├── backend/
│   ├── main.py            # FastAPI app (OAuth, Whisper, Gemini, Gmail)
│   ├── requirements.txt
│   ├── .env.example
│   ├── credentials.json   # ← you add this (downloaded from Google Cloud)
│   └── tokens.json        # ← auto-created after first OAuth login
└── frontend/
    └── index.html         # Single-page app
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/login` | Returns Google OAuth URL |
| GET | `/auth/callback` | OAuth callback, stores token |
| GET | `/auth/status` | Check if Gmail is connected |
| POST | `/auth/disconnect` | Revoke stored token |
| POST | `/transcribe` | Whisper: audio file → text |
| POST | `/generate-email` | Gemini: transcript → email JSON |
| POST | `/send-email` | Gmail API: send email |

---

## Notes

- `tokens.json` is created automatically after the first login — **do not commit it to git**
- The refresh token is stored locally so you only need to log in once
- Whisper runs locally (no API key needed); first run downloads the model (~145 MB for `base`)
- Gemini `gemini-1.5-flash` is used (fast and free-tier friendly)
