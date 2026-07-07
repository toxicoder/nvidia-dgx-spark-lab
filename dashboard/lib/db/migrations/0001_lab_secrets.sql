CREATE TABLE `lab_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`ciphertext` text NOT NULL,
	`value_hint` text NOT NULL,
	`k8s_sync_namespace` text,
	`k8s_sync_secret_name` text,
	`k8s_sync_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_secrets_name_unique` ON `lab_secrets` (`name`);--> statement-breakpoint
CREATE TABLE `secret_audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`secret_id` text,
	`action` text NOT NULL,
	`actor_email` text,
	`created_at` integer NOT NULL
);