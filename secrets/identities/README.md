# Lab identity keys (operator client)

This directory holds **ed25519** key pairs for the official automation users
(`lab-admin`, `lab-ansible`). It is gitignored except this README and `.gitkeep`.

Never commit private keys, PEMs, or live `authorized_keys` material.

Generate (idempotent, does not overwrite):

```bash
bazelisk run //:manage -- identities ensure-keys
```

Then:

```bash
bazelisk run //:manage -- identities plan
bazelisk run //:manage -- identities apply --yes
bazelisk run //:manage -- identities ping
```

Override the directory with `LAB_IDENTITIES_DIR`. Override the bootstrap
(first-contact) key with `LAB_BOOTSTRAP_SSH_KEY`. Day-2 Ansible uses
`secrets/identities/lab-ansible` (or `LAB_ANSIBLE_SSH_KEY` via `--private-key`
on ping).

`status` prints SHA256 fingerprints only — never the key bytes.
