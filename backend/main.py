import os

# Allow OAuth over plain HTTP for local development
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
# Suppress huggingface symlink warning on Windows
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

import json
import asyncio
import queue
import threading
import base64
import tempfile
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse, HTMLResponse
from pydantic import BaseModel

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build

import google.generativeai as genai

from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Weekly Report Sender")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLIENT_SECRET_FILE = Path(__file__).parent / "credentials.json"
TOKENS_FILE = Path(__file__).parent / "tokens.json"
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5500")

def _load_client_config() -> dict:
    """Return the OAuth client config dict from env var or fallback to file."""
    raw = os.getenv("GOOGLE_CREDENTIALS_JSON", "").strip()
    if raw:
        return json.loads(raw)
    if CLIENT_SECRET_FILE.exists():
        return json.loads(CLIENT_SECRET_FILE.read_text())
    raise RuntimeError(
        "No Google credentials found. Set the GOOGLE_CREDENTIALS_JSON "
        "environment variable or add credentials.json to the backend folder."
    )

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

_whisper_model = None
_whisper_lock  = threading.Lock()

def _get_or_load_model():
    global _whisper_model
    with _whisper_lock:
        if _whisper_model is None:
            from faster_whisper import WhisperModel
            size = os.getenv("WHISPER_MODEL", "tiny")
            print(f"[whisper] loading model ({size})…", flush=True)
            _whisper_model = WhisperModel(size, device="cpu", compute_type="int8")
            print("[whisper] model ready.", flush=True)
    return _whisper_model


def load_tokens() -> dict:
    if TOKENS_FILE.exists():
        with open(TOKENS_FILE, "r") as f:
            return json.load(f)
    return {}


def save_tokens(data: dict):
    with open(TOKENS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_credentials() -> Credentials | None:
    tokens = load_tokens()
    if not tokens.get("refresh_token"):
        return None
    creds = Credentials(
        token=tokens.get("token"),
        refresh_token=tokens["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
        scopes=SCOPES,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        tokens["token"] = creds.token
        save_tokens(tokens)
    return creds


# ─── Auth Routes ─────────────────────────────────────────────────────────────

@app.get("/login")
def login():
    try:
        client_config = _load_client_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    return {"url": auth_url}


@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        client_config = _load_client_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    flow.fetch_token(authorization_response=str(request.url))
    creds = flow.credentials

    client_info = client_config.get("web") or client_config.get("installed", {})

    save_tokens({
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "client_id": client_info.get("client_id"),
        "client_secret": client_info.get("client_secret"),
    })

    return RedirectResponse(url=f"{FRONTEND_URL}?connected=true")


@app.get("/auth/status")
def auth_status():
    tokens = load_tokens()
    connected = bool(tokens.get("refresh_token"))
    email = tokens.get("email", "")

    if connected and not email:
        try:
            creds = get_credentials()
            if creds:
                service = build("oauth2", "v2", credentials=creds)
                info = service.userinfo().get().execute()
                email = info.get("email", "")
                tokens["email"] = email
                save_tokens(tokens)
        except Exception:
            pass

    return {"connected": connected, "email": email}


@app.post("/auth/disconnect")
def auth_disconnect():
    save_tokens({})
    return {"status": "disconnected"}


# ─── Transcription ────────────────────────────────────────────────────────────

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    print(f"[transcribe] received audio — {len(data):,} bytes")

    # Load model in thread pool on first call so it never blocks the event loop
    model = await asyncio.get_event_loop().run_in_executor(None, _get_or_load_model)

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    seg_queue: queue.Queue = queue.Queue()

    def run_transcription():
        try:
            print(f"[transcribe] starting — file: {tmp_path}")
            segments, info = model.transcribe(tmp_path, beam_size=1)
            print(f"[transcribe] detected language: {info.language} ({info.language_probability:.0%})")
            full = []
            for seg in segments:
                text = seg.text.strip()
                if text:
                    full.append(text)
                    print(f"[transcribe] segment: {text}")
                    seg_queue.put({"segment": text, "full": " ".join(full)})
            print(f"[transcribe] done — {len(full)} segment(s)")
            seg_queue.put({"done": True, "transcript": " ".join(full)})
        except Exception as e:
            print(f"[transcribe] ERROR: {e}")
            seg_queue.put({"error": str(e)})
        finally:
            os.unlink(tmp_path)

    threading.Thread(target=run_transcription, daemon=True).start()

    async def generate():
        while True:
            try:
                item = seg_queue.get_nowait()
                yield f"data: {json.dumps(item)}\n\n"
                if item.get("done") or item.get("error"):
                    break
            except queue.Empty:
                await asyncio.sleep(0.05)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Email Generation ─────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    transcript: str
    context: str = ""


@app.post("/generate-email")
async def generate_email(req: GenerateRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not set in .env file.",
        )

    system_prompt = """You are an expert at converting voice notes into professional weekly status report emails.

Your task:
1. Extract a clear, professional Subject line
2. Write a well-structured email body with:
   - Brief intro sentence
   - Accomplishments this week (bullet points)
   - Work in progress / blockers (if mentioned)
   - Planned work for next week (if mentioned)
   - Professional closing

Rules:
- Keep it concise and professional
- Use plain text (no markdown formatting in body)
- Infer missing structure from context naturally
- Always start the email body with exactly "Hi," — never use a name or placeholder like "Hi [Name],"
- Return ONLY valid JSON in this exact format:
{
  "to": "",
  "subject": "Weekly Status Report – [Week/Date]",
  "body": "Hi,\n\n..."
}"""

    user_message = f"Voice note transcript:\n\n{req.transcript}"
    if req.context:
        user_message += f"\n\nAdditional context: {req.context}"

    model = genai.GenerativeModel(
        model_name="gemini-3-flash-preview",
        system_instruction=system_prompt,
    )
    response = model.generate_content(user_message)
    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        email_data = json.loads(raw)
    except json.JSONDecodeError:
        email_data = {
            "to": "",
            "subject": "Weekly Status Report",
            "body": raw,
        }

    return email_data


# ─── Send Email ───────────────────────────────────────────────────────────────

class SendRequest(BaseModel):
    to: str
    cc: str = ""
    subject: str
    body: str


@app.post("/send-email")
async def send_email(req: SendRequest):
    creds = get_credentials()
    if not creds:
        raise HTTPException(
            status_code=401,
            detail="Email not connected. Please connect your Gmail account first.",
        )

    print(f"[send] to={req.to!r}  cc={req.cc!r}  subject={req.subject!r}")
    service = build("gmail", "v1", credentials=creds)

    message = MIMEMultipart("alternative")
    message["to"] = req.to
    if req.cc:
        message["cc"] = req.cc
    message["subject"] = req.subject

    plain_part = MIMEText(req.body, "plain")
    message.attach(plain_part)

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    result = service.users().messages().send(
        userId="me",
        body={"raw": raw},
    ).execute()

    return {"status": "sent", "message_id": result.get("id")}


# ─── Serve frontend ───────────────────────────────────────────────────────────

FRONTEND_FILE = Path(__file__).parent.parent / "frontend" / "index.html"

@app.get("/")
def serve_frontend():
    return HTMLResponse(content=FRONTEND_FILE.read_text(encoding="utf-8"))

@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001)
