# Public source snapshot

This repository is the first public source snapshot of Vibe Atlas, prepared on 2026-11-03 from the delivered application and its 75-repository catalog expansion. The supplied ZIP did not contain upstream Git history; no private workspace history is published here.

## Scope

- 159 tools, 40 models, 92 populated tool categories and 34 model tasks.
- 199 generated project Markdown documents, source links, database migrations, tests and the local companion.
- No user database, environment secrets, installed dependencies, build output, internal QA/raw research responses or original hosted project identity.
- Third-party showcase bitmaps are excluded. The catalog refers to upstream image URLs and preserves source attribution; remote images may be rate limited.
- This publishes source code. It does not change or publish an existing hosted site.

Original application contributions use PolyForm Noncommercial 1.0.0 (source-available, noncommercial). Third-party code retains its own notices and licenses; see THIRD_PARTY_NOTICES.md. Catalog entries do not relicense the listed software or model weights.

## Verification

The public preparation reruns the existing catalog validator, TypeScript check, 26 application tests and 22 Python companion tests. The production Worker/client build is checked before the initial public commit. Test logs and internal review receipts are kept outside this repository.

RELEASE_MANIFEST.json records every payload path, byte size and SHA-256, excluding the manifest itself. Verify a Git checkout with:

```text
python3 scripts/verify-publication.py
```

The verifier requires the exact tracked file set to match the manifest plus RELEASE_MANIFEST.json. It does not validate third-party services, GPU inference, production authentication or live moderation.
