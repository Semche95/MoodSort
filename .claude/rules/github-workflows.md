---
paths:
  - ".github/workflows/**"
---

# GitHub Actions versions
- All `.github/workflows/*.yml` share identical versions: `node-version` in `actions/setup-node`, `pnpm/action-setup` tag and `version`, `actions/checkout` and `actions/setup-node` tags. When adding or editing a workflow, match the existing ones rather than picking new ones.
