# Three Kingdoms: Warlord Chronicles

A full-stack strategy web game.

## Prerequisites

*   **Node.js**: v18.0.0 or higher.
*   **Nginx**: Latest stable version.

## 1. Backend Setup

1.  Navigate to `backend/`.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server (this will also initialize the SQLite DB and seed data):
    ```bash
    npm start
    ```
    *Server runs on port 3000.*

## 2. Frontend Setup (Game)

1.  Navigate to `frontend/`.
2.  Create a `vite.config.ts` (if using Vite) or use CRA.
    *   *Note: The provided code is source only. You need a bundler.*
    *   Quick Vite Setup: `npm create vite@latest . -- --template react-ts`
    *   **Overwrite** `src/App.tsx`, `index.html`, etc. with the provided code.
3.  Install dependencies:
    ```bash
    npm install react react-dom react-router-dom lucide-react
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
    ```
4.  Build for production:
    ```bash
    npm run build
    ```
    *Output is in `dist/`.*

## 3. Admin Setup

1.  Navigate to `admin/`.
2.  Follow similar steps to Frontend (init Vite, install dependencies, overwrite files).
3.  Build:
    ```bash
    npm run build
    ```

## 4. Nginx Setup

1.  Copy the provided `nginx.conf` to your Nginx configuration directory (or include it in `nginx.conf`).
2.  **Edit `nginx.conf`**: Change `/path/to/project/...` to the absolute path of your `dist` folders generated in steps 2 and 3.
3.  Reload Nginx: `nginx -s reload`.

## 5. Game Accounts

*   **Game User**: Register on the localhost:80 page.
*   **Admin User**:
    1.  Register a user named `admin` with password `123456` on the game page (frontend).
    2.  Use these credentials to log in to `localhost:8080`.

## Common Issues

*   **CORS**: Ensure Nginx is proxying `/api` correctly or that `cors` is enabled in backend (it is enabled by default in provided code).
*   **Database**: If `sanguo.db` is locked, restart the Node server.
