CREATE TABLE `arena_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`sample_a` text NOT NULL,
	`sample_b` text NOT NULL,
	`protocol_hash` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`revealed_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sample_a`) REFERENCES `arena_samples`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sample_b`) REFERENCES `arena_samples`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`protocol_hash`) REFERENCES `arena_protocols`(`hash`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assignment_distinct_samples" CHECK("arena_assignments"."sample_a" != "arena_assignments"."sample_b")
);
--> statement-breakpoint
CREATE INDEX `idx_arena_assignments_identity` ON `arena_assignments` (`identity_id`);--> statement-breakpoint
CREATE TABLE `arena_protocols` (
	`hash` text PRIMARY KEY NOT NULL,
	`modality` text NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `arena_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`model_revision` text NOT NULL,
	`protocol_hash` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`output_sha256` text NOT NULL,
	`object_key` text NOT NULL,
	`submitted_by` text NOT NULL,
	`media_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`parameters_json` text NOT NULL,
	`provenance_status` text NOT NULL,
	`consent_to_publish` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`protocol_hash`) REFERENCES `arena_protocols`(`hash`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sample_byte_size_positive" CHECK("arena_samples"."byte_size" > 0),
	CONSTRAINT "sample_provenance_valid" CHECK("arena_samples"."provenance_status" IN ('pending','verified','rejected')),
	CONSTRAINT "sample_consent_valid" CHECK("arena_samples"."consent_to_publish" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `idx_arena_samples_protocol_prompt` ON `arena_samples` (`protocol_hash`,`prompt_hash`,`provenance_status`);--> statement-breakpoint
CREATE TABLE `arena_votes` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`winner` text NOT NULL,
	`protocol_hash` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`model_pair_key` text NOT NULL,
	`weight` real NOT NULL,
	`status` text NOT NULL,
	`policy_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `arena_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`protocol_hash`) REFERENCES `arena_protocols`(`hash`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "arena_winner_valid" CHECK("arena_votes"."winner" IN ('a','b','tie','both_bad')),
	CONSTRAINT "arena_weight_valid" CHECK("arena_votes"."weight" BETWEEN 0 AND 1),
	CONSTRAINT "arena_vote_status_valid" CHECK("arena_votes"."status" IN ('accepted','quarantined','withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_arena_vote_unique_evidence` ON `arena_votes` (`identity_id`,`protocol_hash`,`prompt_hash`,`model_pair_key`);--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`verified_usage_count` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	CONSTRAINT "identity_usage_nonnegative" CHECK("identities"."verified_usage_count" >= 0),
	CONSTRAINT "identity_state_valid" CHECK("identities"."state" IN ('active','review','suspended'))
);
--> statement-breakpoint
CREATE TABLE `metric_snapshots` (
	`item_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`source` text NOT NULL,
	`metrics_json` text NOT NULL,
	`coverage` real NOT NULL,
	`policy_version` text NOT NULL,
	PRIMARY KEY(`item_id`, `captured_at`, `source`)
);
--> statement-breakpoint
CREATE TABLE `project_votes` (
	`item_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`rating` integer NOT NULL,
	`weight` real NOT NULL,
	`risk` real NOT NULL,
	`status` text NOT NULL,
	`reason_codes` text DEFAULT '[]' NOT NULL,
	`policy_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`item_id`, `identity_id`),
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vote_rating_valid" CHECK("project_votes"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "vote_weight_valid" CHECK("project_votes"."weight" BETWEEN 0 AND 1),
	CONSTRAINT "vote_risk_valid" CHECK("project_votes"."risk" BETWEEN 0 AND 1),
	CONSTRAINT "vote_status_valid" CHECK("project_votes"."status" IN ('accepted','quarantined','withdrawn'))
);
--> statement-breakpoint
CREATE INDEX `idx_project_votes_summary` ON `project_votes` (`item_id`,`status`);--> statement-breakpoint
CREATE TABLE `rate_buckets` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_expiry` ON `rate_buckets` (`expires_at`);--> statement-breakpoint
CREATE TABLE `risk_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`item_id` text NOT NULL,
	`explanation` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "appeal_status_valid" CHECK("risk_appeals"."status" IN ('open','resolved','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_open_appeal` ON `risk_appeals` (`identity_id`,`item_id`) WHERE "risk_appeals"."status" = 'open';--> statement-breakpoint
CREATE TABLE `vote_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`item_id` text NOT NULL,
	`action` text NOT NULL,
	`risk` real NOT NULL,
	`weight` real NOT NULL,
	`reason_codes` text NOT NULL,
	`policy_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_vote_audit_identity_time` ON `vote_audit` (`identity_id`,`created_at`);