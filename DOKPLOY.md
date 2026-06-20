# Deploying to Dokploy

This site is a static [Vite](https://vite.dev) build. The included `Dockerfile`
builds it with Node and serves the output `dist/` with nginx, so Dokploy can
deploy it as a standard Docker application.

Files involved:

- `Dockerfile` — multi-stage build (Node 22 → nginx 1.27).
- `nginx.conf` — clean URLs for the multi-page build (`/`, `/story/`), asset
  caching, `404.html` fallback.
- `.dockerignore` — keeps the build context small.

The container listens on **port 80**.

---

## 1. One-time: connect GitHub to Dokploy

For automatic deploys and feature-branch previews you want the **GitHub App**
integration (not a plain PAT/SSH source — previews require the App).

1. In Dokploy: **Settings → Git → GitHub → Create GitHub App**.
2. Install the App on the `simonbermudez/simonbermudez.com` repository.

---

## 2. Deploy production (`master`)

1. **Create Application** → pick a project (e.g. `simonbermudez`).
2. **Provider:** GitHub → repo `simonbermudez.com`, **Branch:** `master`.
3. **Build Type:** `Dockerfile` (path: `./Dockerfile`).
4. **Deploy** once to build the image and start the container.
5. **Domains → Add Domain:**
   - Host: `simonbermudez.com` (and/or `www.`)
   - **Container Port: `80`**
   - Enable **HTTPS** + **Let's Encrypt** for an automatic certificate.
6. Point your DNS `A` record at the Dokploy server's IP.

### Auto-deploy on push

On the application's **Deployments** tab, copy the **Webhook URL** and add it in
GitHub (**Settings → Webhooks**), or just toggle **Auto Deploy** on — with the
GitHub App connected, every push to `master` rebuilds and redeploys.

> The existing `.github/workflows/deploy.yml` (FTP deploy) can be deleted once
> you've cut over to Dokploy, so the two don't fight over the same site.

---

## 3. Deploy feature branches

You have two options.

### Option A — Preview Deployments (recommended, automatic per-PR)

Dokploy can spin up an isolated, throwaway deployment for **every pull request**
and tear it down when the PR closes.

**Prerequisites**

- The **GitHub App** integration from step 1 (PATs can't do previews).
- A **wildcard DNS record**: `*.preview.simonbermudez.com` → server IP.

**Setup**

1. Open the production application → **Preview Deployments** tab.
2. **Enable Preview Deployments.**
3. Set the **Preview Domain / wildcard base** to `preview.simonbermudez.com`
   (Dokploy gives each PR a unique subdomain under it, e.g.
   `pr-42-preview.simonbermudez.com`).
4. Set **Container Port** to `80` (same as production).

Now opening a PR builds that branch with the same `Dockerfile` and posts the
preview URL; pushes to the PR redeploy it; closing the PR removes it.

### Option B — A dedicated app per branch (manual, persistent)

Use this when you want a long-lived environment for a specific branch (e.g. a
`staging` branch) rather than per-PR previews.

1. **Create Application** (same repo) → set **Branch** to your feature branch.
2. **Build Type:** `Dockerfile`.
3. **Domains → Add Domain:** give it its own host, e.g.
   `staging.simonbermudez.com`, **Container Port `80`**, HTTPS on.
4. Enable **Auto Deploy** so pushes to that branch redeploy it.

Repeat for each branch you want a standing environment for. Delete the
application when the branch is done.

---

## Local sanity check

To reproduce the production container locally (requires Docker):

```bash
docker build -t simonbermudez .
docker run --rm -p 8080:80 simonbermudez
# open http://localhost:8080  and  http://localhost:8080/story/
```
