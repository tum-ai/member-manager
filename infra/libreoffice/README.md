# Contract LibreOffice image

This image is the fixed DOCX to PDF runtime used by Vercel Sandbox. The Debian
base, package snapshot, LibreOffice version, and replacement fonts are pinned.

## Publish to Vercel Container Registry

Link the repository to the correct Vercel project and pull a current OIDC token:

```bash
vercel link
vercel env pull .vercel/.env.vcr.local
```

Load that ignored file in your shell, then authenticate Docker:

```bash
set -a
source .vercel/.env.vcr.local
set +a
printf '%s' "$VERCEL_OIDC_TOKEN" | docker login vcr.vercel.com --username oidc --password-stdin
```

Replace the team and project slugs, then build and push both supported platforms:

```bash
export CONTRACT_VCR_IMAGE="vcr.vercel.com/team-slug/project-slug/contract-libreoffice:libreoffice-7.4.7-deb12u14-20260818"
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --file infra/libreoffice/Dockerfile \
  --output "type=image,name=${CONTRACT_VCR_IMAGE},push=true,oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true" \
  infra/libreoffice
```

Never overwrite this tag. Create a new versioned tag when the image changes.

Inspect the pushed image and copy its manifest digest:

```bash
docker buildx imagetools inspect "$CONTRACT_VCR_IMAGE"
```

Set this Vercel server environment variable for Production and Preview:

```text
CONTRACT_LIBREOFFICE_SANDBOX_IMAGE=vcr.vercel.com/team-slug/project-slug/contract-libreoffice@sha256:<64-hex-character-digest>
```

The digest is required. A tag by itself is rejected so a later image push
cannot silently change how existing contracts render.

Vercel deployments authenticate to Sandbox automatically through OIDC.
