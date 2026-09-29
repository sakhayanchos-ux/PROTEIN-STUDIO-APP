# PROTEIN STUDIO — client journey update

## Behaviour
- Client menu has 10 entries. Nutrition and water remain accessible from My Plan. The existing community chat is unchanged and labelled «Группа поддержки».
- The weight-program estimate uses starting weight minus target weight. Fractional gaps use the next matching upper bound; non-loss goals have no loss estimate; >90 kg gets an individual-planning message. The estimate is not a promised result.
- Marathon percentage = completed task count / frozen task count across 30 days. Stars are independent of percentage. Days unlock at midnight Asia/Yakutsk.
- Six default daily tasks: workout, workout photo, food diary photo, day plan, 5,000 steps, topic view. A consultant can configure defaults for future snapshots. Existing snapshots do not change retrospectively.
- Topics retain the existing day/source table and activity records. Opening a link records a view, not proof that the material was read.
- Workout catalogue supports official Herbalife YouTube links and consultant-uploaded video. No external video is fabricated or auto-endorsed: consultants add their selected sources through the editor. Existing exercise recommendations remain available.
- Weight awards are recorded only on days 10, 20, 30, once per checkpoint. Award = max(0, floor((baseline - checkpoint weight) / 0.5) - previously awarded weight stars). Fractional losses accumulate and regain does not enable earning the same stars again. Checkpoints also use the existing progress-saving function.
- Five individual gifts per enrollment: 10/25/50/75/100%. Before unlock, a consultant can change the gift. An unassigned unlocked gift may be assigned once; an assigned unlocked gift is immutable. Claim and issue are idempotent, serialized using enrollment/reward row locks.
- Notifications are in-app, with an unread counter refreshed every 30 seconds while the app is open. This release does not claim OS push delivery.
- Consultants see only assigned clients. Client progress/task marks are read-only in their dossier. Gifts are editable only through authorized RPC actions.
- Black Gold is a fifth locally saved theme, using a code-generated marble SVG asset.

## Database
Applied via Supabase migration `client_marathon_tasks_workouts_individual_rewards`.
New tables: `ps_workouts`, `ps_workout_logs`, `ps_marathon_task_templates`, `ps_marathon_tasks`, `ps_marathon_weight_checks`, `ps_marathon_rewards`, `ps_notifications`.
Added enrollment columns: `task_plan_ready`, `weight_baseline`, `legacy_stars`. Existing stars are preserved as the baseline before new task tracking.
Reused `ps_marathon_activity`, `ps_marathon_days`, `ps_marathon_enrollments`, all profile/progress/chat tables, and existing auth.
Private buckets: `ps-task-photos` (10 MB images), `ps-workout-media` (50 MB images/videos). No public read policies.
`ps_private.prepare` and `ps_private.refresh` are internal only. Public RPC wrappers explicitly check auth and ownership/coaching scope, use an empty search path, and revoke anonymous execution. New tables are RLS-protected and have no direct client write grants except own notification read-status updates. Database advisory warnings about authenticated SECURITY DEFINER wrappers are intentional for these guarded transaction endpoints; no new anonymous endpoint is exposed.

## Verification
- Transaction/rollback tests with authenticated roles: denied future tasks, fake photos, cross-client reads, consultant editing client tasks, direct star/reward updates and client-issued gifts.
- Verified task/workout idempotency, checkpoint gating, gain preserves stars, reward unlock, gift locking, one request notification and repeat-safe issuance.
- Weight examples 0.4 / 0.8 / 1.5 / 2.2 kg return 0 / 1 / 3 / 4 stars.
- Program range boundary tests including fractional differences and non-loss goals.
- Headless Chromium phone viewport: client screens, program/progress, task action, locked topics, five rewards, workout form, staff dossier/editor; zero JavaScript errors and no horizontal overflow at 390 px.
- UI tests use mock profiles and RPC responses. Live DB tests roll back all fixtures. Actual phone photo/share/YouTube hand-off remains a device acceptance check.
- Auth, community implementation and before/after storage are retained. No working user records were deleted.
