# NoteWise: AI search that saves to your OneNote

Ask a question, get a web-grounded answer with numbered sources, and save it into your real Microsoft OneNote through the Microsoft Graph API.

**Stack:** React + Vite + Tailwind CSS, Node.js + Express, PostgreSQL, Anthropic API, Tavily search, Microsoft OAuth 2.0 (PKCE) + Graph.

## What is included

| Area | Status |
|---|---|
| Register, login, logout, refresh rotation, change password, delete account | Done |
| Chats: create, list, search, rename, delete, persistent history | Done |
| Streaming AI answers, web search with citations, follow-up suggestions, stop button | Done |
| Image upload (type sniffing, 5 MB limit), image questions, avatar | Done |
| OneNote: connect, status, notebooks, sections, save page (full or selected text, sources, timestamp), saved list, disconnect, reconnect handling | Done |
| Dark/light, responsive sidebar and drawer, skeletons, empty and error states, toasts, Ctrl+K | Done |
| Forgot-password email flow, regenerate answer, tests, CI | Not included yet (next steps) |

## Setup

Requirements: Node 20+, PostgreSQL 14+.

```bash
# 1. database
createdb notewise

# 2. backend
cd backend
cp .env.example .env        # then fill in the values (see below)
npm install
npm run migrate             # creates all tables from ../database/schema.sql
npm run dev                 # http://localhost:4000

# 3. frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173  (proxies /api to :4000)
```

Open http://localhost:5173, create an account, and ask a question.

### Environment variables (backend/.env)

| Name | Purpose |
|---|---|
| DATABASE_URL | MySQL connection string |
| JWT_SECRET | Random 48+ byte string for signing access tokens |
| TOKEN_ENC_KEY | 64 hex characters; encrypts Microsoft tokens (AES-256-GCM) |
| ANTHROPIC_API_KEY, AI_MODEL | AI provider key and model name your account supports |
| TAVILY_API_KEY | Optional. Without it the app answers without web sources |
| MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI | Microsoft app registration |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # TOKEN_ENC_KEY
```

### Microsoft app registration (OneNote)

Follow Microsoft's current docs for exact screens; the settings you need are:

1. Azure portal > Microsoft Entra ID > App registrations > New registration.
2. Supported account types: include **personal Microsoft accounts** (for example "Accounts in any organizational directory and personal Microsoft accounts").
3. Redirect URI: platform **Web**, value `http://localhost:4000/api/v1/onenote/callback`. Add your production URL later.
4. Certificates & secrets: create a client secret; copy the **value** into `MS_CLIENT_SECRET`.
5. API permissions > Microsoft Graph > **Delegated**: `User.Read`, `Notes.ReadWrite`, `offline_access`. (App-only access is not supported for OneNote.)
6. Copy the Application (client) ID into `MS_CLIENT_ID`.

Work or school accounts may need administrator consent depending on the organization's policy. Test first with a free personal Microsoft account that has a notebook.

## Project layout

```
backend/src/   routes (HTTP) > services (logic) > db (Postgres); middleware: auth, CSRF header, errors
frontend/src/  pages, components, lib (api client, auth, theme, toast)
database/      schema.sql
```

## Security notes

- Passwords: bcrypt (cost 12). Sessions: 15-minute JWT plus rotating refresh token (stored hashed), both in httpOnly cookies.
- CSRF: SameSite cookies plus a required `X-Requested-With` header on state-changing requests.
- Microsoft tokens: encrypted at rest, never sent to the browser. OAuth uses `state` and PKCE.
- Every query is scoped by user id. Uploads are verified by file signature and stored under random names.
- Rate limits on auth and on AI messages. Helmet and a strict CORS origin are enabled.
- **Production:** serve frontend and API over HTTPS. If they are on different sites, cookies use `SameSite=None; Secure` (already set when `NODE_ENV=production`) and you must set `CLIENT_URL` and `VITE_API_URL`. Consider putting both on subdomains of one domain.

## Known limitations

- The follow-up and title generation use extra model calls (small cost).
- Uploaded files are stored on local disk; use object storage when deploying to a host with an ephemeral filesystem.
- Chat context sends the last 12 messages; there is no long-term summarization yet.

## Developer
Shaurya Saxena
- Aspiring Data Scientist and Web Developer