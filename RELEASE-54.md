# Release 54 — video, private chat, individual marathon and PWA push

## Application changes

- Client workouts now contain only videos. YouTube embeds use a validated video ID with a fallback link; uploads use a native inline video player. Source switching disables and hides the unused required field. Existing workout data is retained.
- Separate private client/assigned-consultant threads support messages, images, replies, timestamps and unread counts. Group reactions, replies, images and pins are retained. Both chats use actual profile avatars when available, otherwise initials.
- Menu badges show group, private-message and notification unread totals. Opening a conversation acknowledges its loaded messages; opening notifications acknowledges loaded events.
- PWA push opt-in/out, encrypted Web Push, VAPID, a protected delivery endpoint, per-user subscriptions, database event queue and scheduled retries. Push clicks route to the relevant screen. iPhone requires installation to the Home Screen. Permission remains an explicit user action.
- The 30-day marathon displays three 10-day stages and today's tasks. Overall percentage still covers 30 days. Existing checkpoint rules and immutable earned stars remain.
- Per-client task settings update only unfinished tasks from today onward; completed tasks and their star values stay intact. Disabled tasks are excluded from percentage. Existing consultant templates remain available.
- Individual gifts are editable until unlock. A previously unassigned gift may be assigned once after unlock; an existing unlocked gift cannot be replaced. Coupons have themed backgrounds, group/external sharing and PNG download. Repeated reward claims and issuance remain idempotent.
- Client dossiers show measurements, goals, birth date, marathon, workouts, tasks, rewards and stored result photos/collages.
- Result-use consent is requested in private chat and can be accepted, denied or revoked. Consent covers the specific saved asset paths at request time; new images require a new request. The download endpoint checks consent on every new request. Displaying an image cannot prevent screenshots or copying pixels; this is not DRM. Short-lived preview URLs expire in 60 seconds.
- Nutrition removes redundant helper copy and corrects Protein Bites to 4g per piece. Aloe/CR7 and health limitations remain.
- Consultant client preview remains read-only, including Edge Function mutations, with a shorter return banner.

## Changed repository files

app.js, community.js, consultant-card.js, workspace.js, journey.js, workout-library.js, coach.js, index.html, sw.js.
New: messages.js, client-extras.js, features.css, supabase/functions/ps-delivery/index.ts, database/release54*.sql, RELEASE-54.md.

## Database additions and modifications

New public tables: ps_direct_threads, ps_direct_messages, ps_result_consents, ps_chat_reads, ps_push_subscriptions.
New private tables: ps_private.push_config, ps_private.push_queue.
Added columns: ps_notifications.event_key/route; ps_marathon_tasks.active.
Private Storage bucket: ps-direct. No public photo bucket.

RPCs: ps_thread_access, ps_open_dialog, ps_send_direct, ps_mark_chat_read, ps_unread_counts, ps_chat_people, ps_chat_avatar_visible, ps_request_result_consent, ps_answer_result_consent, ps_result_access, ps_set_client_task. ps_push_server is service-role-only.
Updated marathon completion/workout/state/refresh/reward functions. Notification event triggers cover measurements, workouts, task photos, day completion, reward unlock and private messages; existing gift-request events remain. Added indexes and private-message Realtime publication. Fixed the pre-existing YouTube URL check's escaped-dot expression.

All new public tables have RLS and explicit grants. Private tables default-deny client access. Membership is checked against the active consultant-client link; a profile role label alone grants no access. VAPID private keys and webhook token are stored only in the private database table, not committed to GitHub. Edge dispatch authenticates a random server-only token; user operations validate the Supabase access token using getUser. verify_jwt=false is intentional for this mixed webhook/user endpoint.

Enabled pg_net and pg_cron. ps-push-retry runs once per minute for pending jobs, with bounded retries. Expired provider subscriptions are removed. No scheduled reminder content was added.

## Validation

Live transaction tests rolled back completely: private-thread isolation, idempotent sending, unread acknowledgement, consent deny/grant/revoke checks, server-only push privileges; workout idempotency and task credit; individual changes preserve earned stars; 1.5kg reduction awards 3 stars; gain never removes stars.
Browser tests with mocked data: client and consultant routes, mobile 320/390px, business/result/preview regression, source switch, stage UI, coupons, nutrition, private message/reply/badges, no JS errors.
Push server responded HTTP 200 to authenticated empty dispatch; VAPID signing and encrypted payload generation tested locally without sending. Actual iPhone delivery, camera uploads and native sharing need device verification after opt-in.

Security advisors reviewed: protected definer RPCs are intentional authenticated endpoints; private no-policy tables intentionally deny client access. Existing leaked-password-protection setting was not changed.

No accounts, measurements, result photos, chat history or existing marathon records were deleted. Test data was rolled back and no test messages were sent to users.
