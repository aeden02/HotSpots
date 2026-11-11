# HotSpots
 
HotSpots helps visitors to Fort Smith find locally recommended places that paid listings miss, and gives locals an easy way to add them. Visitors can browse spots by city and category, open spot details, and describe what they're looking for to get AI-ranked results.
 
**Team 4, CS 40003 Software Engineering, University of Arkansas – Fort Smith, Fall 2026**
 
| Member | Responsibilities |
|---|---|
| Christian Rawley | Tech Lead, Backend, Database |
| Allison Eden | Product Owner, Frontend, Quality/DevOps |
| Thien Le | Scrum Master, AI/ML |
 
## Tech stack
 
| Part | Tool |
|---|---|
| Frontend | React (Vite) |
| Backend | Express (Node.js) |
| Database | MongoDB |
| AI | Ollama (local models) |
| Containers | Docker Compose |
 
Full versions and licenses are in [DEPENDENCIES.md](DEPENDENCIES.md).
 
---
 
## Prerequisites
 
You need **Git** and a **container engine** that supports `docker compose`. The team uses **Rancher Desktop** (open source) instead of Docker Desktop.
 
### Windows
 
Run these in **PowerShell as Administrator** (right-click Start → Terminal (Admin)).
 
1. **Turn on WSL2**, then restart your computer:
```powershell
   wsl --install
```
2. **Install Git**:
```powershell
   winget install --id Git.Git -e
   git config --global core.autocrlf input
```
3. **Install Rancher Desktop**:
```powershell
   winget install --id SUSE.RancherDesktop -e
```
   On first launch, set **Container engine** to **dockerd (moby)** and **uncheck Kubernetes**. Wait until it finishes starting.
4. **Check it works** (in a new, normal terminal):
```powershell
   docker run hello-world
```
   You should see "Hello from Docker!"
 
### macOS / Linux
 
- **macOS:** install Git and [Rancher Desktop](https://rancherdesktop.io/) (choose **dockerd (moby)**, uncheck Kubernetes).
- **Linux:** install Git, [Docker Engine](https://docs.docker.com/engine/install/), and the Docker Compose plugin.
Check with `docker run hello-world`.
 
### Only for local development (optional)
 
To run the frontend outside Docker, install **Node.js 22** (the version in `.nvmrc`). On Windows, [nvm-windows](https://github.com/coreybutler/nvm-windows) makes this easy:
```powershell
nvm install 22
nvm use 22
```
 
---
 
## Setup and run
 
1. **Clone the repo** and go into it:
```bash
   git clone https://github.com/aeden02/HotSpots.git
   cd HotSpots
```
2. **Create your settings file** from the example:
```bash
   cp .env.example .env
```
   (In Windows PowerShell, `cp` works too.) Never commit `.env`.
3. **Start everything** (make sure Rancher Desktop is running first):
```bash
   docker compose up --build
```
   The first run downloads several GB of images and can take a few minutes.
4. **Download the AI model** (first time only; it's saved between restarts). In a second terminal:
```bash
   docker compose exec ollama ollama pull <MODEL-NAME>
```
   <!-- TODO (Thien): replace <MODEL-NAME> with the chosen model(s). -->
5. **Load the Fort Smith data** (first time only):
```bash
   <IMPORT-COMMAND>
```
   <!-- TODO (Christian): replace with the OpenStreetMap import command. -->
6. **Open the app:** http://localhost:5173
### Services
 
| Service | URL | Purpose |
|---|---|---|
| Frontend | http://localhost:5173 | React app |
| Backend | http://localhost:4000 | Express API |
| MongoDB | localhost:27017 | Database |
| Ollama | http://localhost:11434 | Local AI models |
 
### Stop
 
Press `Ctrl+C` in the terminal running Compose, or run:
```bash
docker compose down
```
Your data is kept in Docker volumes, so it's still there next time you start.
 
To **wipe all data** and start fresh (this deletes the database and downloaded models):
```bash
docker compose down -v
```
 
---
 
## Development
 
Work on a branch, never directly on `main`:
```bash
git checkout -b feature/<what-you-are-doing>
```
Push it, open a pull request, and get one teammate's review. CI must pass before merging.
 
### Frontend without Docker
 
Faster for day-to-day work because the page updates as you save:
```bash
cd frontend
npm install
npm run dev
```
API calls to `/api/...` are forwarded to the backend at `http://localhost:4000` (set in `frontend/vite.config.js`).
 
### Tests and checks
 
From `frontend/`:
```bash
npm run lint    # check code style and common mistakes
npm run build   # make sure the app builds
npm test        # run tests
```
<!-- TODO (Christian): add backend test commands. -->
 
CI runs these automatically on every push and pull request (see `.github/workflows/ci.yml`), and also checks that the Docker images build.
 
---
 
## Project structure
 
```
.
├── frontend/            React app (Vite)
├── backend/             Express API
├── .github/workflows/   CI configuration
├── docker-compose.yml   Starts all services
├── .env.example         Settings template (copy to .env)
├── .nvmrc               Node.js version
├── DEPENDENCIES.md      Dependency inventory
└── README.md
```
 
---
 
## Troubleshooting
 
**`failed to connect to the docker API ... dockerDesktopLinuxEngine`**
Docker is pointed at Docker Desktop instead of Rancher Desktop. Make sure Rancher Desktop is running, then:
```bash
docker context use default
```
 
**`no configuration file provided: not found`**
You're not in the repo root. `cd` to the folder that contains `docker-compose.yml`.
 
**`port is already allocated`**
Something else is using that port (often a second copy of the app). Run `docker compose down`, or stop the other program.
 
**Line-ending warnings (`LF will be replaced by CRLF`)**
Harmless. Run `git config --global core.autocrlf input`. The repo's `.gitattributes` keeps files in Linux format.
 
**Ollama is slow or crashes (Windows)**
WSL2 may need more memory. Create `C:\Users\<you>\.wslconfig` with:
```
[wsl2]
memory=8GB
```
Use about half your computer's RAM, then run `wsl --shutdown` and restart Rancher Desktop.
 
---
 
## Data attribution
 
Spot data includes information from OpenStreetMap. © OpenStreetMap contributors, available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
 