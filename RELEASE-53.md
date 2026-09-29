# Release 53 — separate consultant workspace

Consultants open their own My Plan with Business and Result tabs. Business tracks monthly goals and daily actuals for points, wellness assessments, scans, meetings, business conversations, contacts and new clients. Weekly targets and analysis are separate from monthly targets. Weeks close Monday 00:00 Asia/Yakutsk; previous daily facts, weekly targets and analysis become immutable. Missing weeks are materialized on the next authenticated visit, without requiring a scheduled job.

Result reuses the consultant's existing assessments, measurements and before/after photo workflow. Weight-only and waist-only records retain the last known value of the other metric. No profiles, measurements, photos or messages were deleted.

The roster excludes the consultant's own linked profile and explicitly identified legacy self profiles. Other consultants who are genuinely assigned clients are not globally excluded.

Client Version is a read-only preview with sample marathon tasks. It preserves the staff session and restores the consultant workspace on return. Writes, photo uploads, messages and logout are blocked in preview; theme selection remains available locally.

My QR Codes provides a local-generated client registration QR with a consultant referral. Existing accounts are not reassigned on login. Consultant invitations are one-use, expire after seven days and are bound to the recipient's existing phone-based login email. Only a token hash is stored. Tokens stay in URL fragments/session storage, are cleared after successful redemption, and can be revoked by their issuer. Role changes occur in guarded database functions, never from client-supplied signup role metadata.

## Database

Applied migrations: coach_business_workspace_and_secure_invitations; scope_coach_self_exclusion_to_own_roster. Final definitions are in database/release53.sql.

New tables: public.ps_coach_self_profiles, public.ps_business_months, public.ps_business_days, public.ps_business_weeks, ps_private.coach_invitations. Existing active mapped consultant profile roles were synchronized. Existing unmapped consultant records were retained for phone-bound invitation acceptance.

Business rows are isolated by authenticated owner. Direct business writes and private invitation table access are denied; mutations use guarded RPCs. Existing Auth signup trigger and storage/photo policies are preserved.

## Validation

Database transaction tests (rolled back): self exclusion and real-client retention; business isolation; idempotent daily saves; closed-week immutability; Yakutsk Monday boundary; invitation phone binding, role activation, idempotency and revocation; denial of client role self-promotion.

Browser tests with mocked data: client routes, consultant tabs and business save, own charts/photos, read-only preview and return, QR UI, referral registration preselection, invitation handling, dossier, 320/390px layouts and no JavaScript errors. Client QR image independently decoded to its exact registration URL. Real-device camera and native share-sheet behavior require phone verification.
