# Security Specification for Digicoup Connect

## Data Invariants
1. A `ScheduledPost` must belong to an authenticated user (`userId`).
2. Users can only read and write their own `ScheduledPost` documents.
3. `UserSetting` is private to the user.
4. Timestamps (`createdAt`, `updatedAt`) must be server-validated.
5. Critical fields like `userId` are immutable after creation.
6. `status` transitions must be valid (e.g., from `pending` to `sent`).

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: `create` a post with `userId` of another user.
2. **Resource Poisoning**: `create` a post with a 1MB string in `status`.
3. **Privilege Escalation**: `update` a post to change the `userId`.
4. **Timestamp Fraud**: `create` a post with a future `createdAt` from client.
5. **Orphaned Write**: `create` a post without a required field `platform`.
6. **Shadow Update**: `update` a post with an extra field `isSystemAdmin: true`.
7. **Cross-Tenant Access**: `get` a `UserSetting` document belonging to another UID.
8. **Malicious ID**: `create` a document with an ID that is a 2KB junk string.
9. **Unauthenticated Write**: `create` a post without being logged in.
10. **Type Mismatch**: `update` `time` field to a boolean instead of a string.
11. **Illegal State Step**: `update` a `sent` post back to `pending` (if terminal states are locked).
12. **PII Leak**: `list` all `user_settings` as an unauthenticated user.

## Test Runner (firestore.rules.test.ts)
*(Mocked for this spec)*
- `test('Deny cross-user read', ...)`
- `test('Enforce server timestamps', ...)`
- `test('Strict schema validation', ...)`
