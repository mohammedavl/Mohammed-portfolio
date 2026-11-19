# Publish the DevOps portfolio to GitHub Pages

Target repository: https://github.com/mohammedavl/Mohammed-portfolio

These files prepare deployment; they do not upload or publish the repository.

## Publish from source

1. Upload the project source to the target repository, preserving its directory structure. Include the root package files, pnpm lockfile and workspace file, TypeScript configs, `artifacts/devops-lab`, shared `lib` packages, `scripts/build-github-pages.mjs`, and `.github/workflows/github-pages.yml`. Exclude secrets, `.env` files, `.local`, `.agents`, `node_modules`, and build outputs.
2. In the repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Open **Actions → Publish DevOps portfolio to GitHub Pages → Run workflow**.
4. After the job succeeds, use the deployed URL shown in the workflow or Pages settings.

The workflow runs manually. Later source changes require another **Run workflow** to publish.

## Local Pages build

From the workspace root:

```sh
pnpm install --frozen-lockfile
node scripts/build-github-pages.mjs /Mohammed-portfolio/
```

The output is `artifacts/devops-lab/dist/public`. Only that static directory is hosted: no backend, database, cloud credentials, or API keys are needed.

The script builds assets with the repository path and exports a real HTML entry for home, about, the game, and each of the 15 labs, so refreshing or directly opening a project works on GitHub Pages without server rewrites.

The Replit preview continues to use its existing root path. For a custom domain or user-site repository, use `/` as the build base; the workflow obtains this from GitHub Pages automatically.
