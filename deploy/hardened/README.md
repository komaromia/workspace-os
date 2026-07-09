# Hardened profile

Bank-deployable production profile: deploy inside the bank's security boundary, private image
registry mirror, signed images, egress allowlist, internal-only MCP, federated SSO/MFA, secrets
in the bank's vault, encryption at rest via their KMS/HSM, TLS/mTLS in transit.

Manifests not yet written — see
[`docs/epics/15-deployment-hardening.md`](../../docs/epics/15-deployment-hardening.md) and
[`docs/epics/16-model-governance-compliance.md`](../../docs/epics/16-model-governance-compliance.md).
