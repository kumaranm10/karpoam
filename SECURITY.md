# Security

Karpoam is a static site for children: no accounts, no personal data, no server code.

**Report a problem:** open a private advisory at Security → Advisories → "Report a vulnerability" in this repository.

## Automatic protection on every change
| Check | Tool |
|---|---|
| Known vulnerable dependencies (high/critical) | `npm audit` on every PR, Dependabot weekly |
| Secrets committed by mistake | gitleaks |
| Code weaknesses | CodeQL (JavaScript/TypeScript and workflows), weekly and on every PR |
| Broken or unsafe workflow files | actionlint |
| Outdated dependencies and actions | Dependabot, weekly, 14-day cooldown on new releases |
| Supply chain | Every GitHub Action pinned to a commit SHA |
| Review | Every PR reviewed by a second AI agent; changes to the review guards need the owner |
