# Run SASYNA locally on Windows 11

SASYNA's local model and browser storage do not use paid AI APIs or cloud
storage. The app must be served from `localhost` so it can reach LM Studio.

## One-time setup

1. Install Node.js 24 and enable pnpm through Corepack.
2. In the project folder, run `pnpm install` while online. This downloads the
   app dependencies; a working install can then be used without internet.
3. Install LM Studio and download the local model files you want to use
   (Qwen, Gemma, or DeepSeek). Model downloads require internet once.
4. In LM Studio, load a model and start its local server on
   `http://localhost:1234`.
5. Allow browser requests from `http://localhost:5173` in LM Studio's local
   server settings if CORS is enabled there.

## Start the app

Open PowerShell in the project folder and run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\windows\start-sasyna.ps1
```

Open `http://localhost:5173`, then go to **LM Studio & models**, check the
endpoint, and choose a model returned by LM Studio. If the app cannot reach
LM Studio, it will show an error and will not create placeholder AI output.

## Data and connectivity

- Proposal details, section drafts, local instructions, preferences, and
  uploaded source files are stored in this browser's IndexedDB on this device.
- Word exports are downloaded to a local folder selected by the browser.
- Local model generation works without internet once SASYNA, LM Studio, and a
  model are installed and running.
- Downloading dependencies or model weights requires internet. Academic
  reference verification, geographic lookups, and updates are intended to be
  user-triggered online features; they are not silently run in the background.
- No Supabase, Cloudflare R2, hosted AI provider, or automatic cloud sync is
  included.
- Browser site-data deletion can erase the local workspace. Keep a copy of
  exported Word files and source materials.

The Replit preview is not the locally running Windows app. It is useful for
reviewing the interface, but it cannot verify LM Studio connectivity on the
user's laptop.
