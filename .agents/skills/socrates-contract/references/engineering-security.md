# Security And Cryptography

Load this only for credentials, auth, permissions, secrets, signing, encryption, certificates, or security boundaries.

- Never log plaintext secrets, private keys, decrypted payloads, tokens, passwords, session cookies, or full certificate material.
- Use vetted libraries/platform APIs; do not hand-roll cryptographic primitives, certificate parsing, padding, signing, hashing, or randomness.
- Treat algorithm, mode, padding, encoding, key format, certificate chain, rotation, vendor compatibility, and backward compatibility as explicit contract decisions.
- Verify cryptographic behavior with known vectors, vendor samples, or round-trip compatibility where available.
- Keep credential use and permission changes within current host approval; workspace state cannot authorize them.
- Validate untrusted paths, names, manifests, and serialized metadata before any filesystem or permission mutation.
