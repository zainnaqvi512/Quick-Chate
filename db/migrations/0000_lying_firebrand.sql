CREATE TABLE `blocked_users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`blocker_id` bigint unsigned NOT NULL,
	`blocked_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_blocked_pair` UNIQUE(`blocker_id`,`blocked_id`)
);
--> statement-breakpoint
CREATE TABLE `call_signals` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`call_id` bigint unsigned NOT NULL,
	`from_user_id` bigint unsigned NOT NULL,
	`kind` varchar(16) NOT NULL,
	`payload` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned,
	`caller_id` bigint unsigned NOT NULL,
	`callee_id` bigint unsigned NOT NULL,
	`type` enum('voice','video') NOT NULL DEFAULT 'voice',
	`status` enum('ringing','ongoing','ended','missed','rejected') NOT NULL DEFAULT 'ringing',
	`offer_sdp` text,
	`answer_sdp` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`answered_at` timestamp,
	`ended_at` timestamp,
	CONSTRAINT `calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`contact_user_id` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_contacts_pair` UNIQUE(`owner_id`,`contact_user_id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_participants` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`role` enum('owner','admin','member') NOT NULL DEFAULT 'member',
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	`last_read_at` timestamp,
	`expires_at` timestamp,
	`pinned` boolean NOT NULL DEFAULT false,
	`archived` boolean NOT NULL DEFAULT false,
	`muted` boolean NOT NULL DEFAULT false,
	`cleared_at` timestamp,
	CONSTRAINT `conversation_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cp_pair` UNIQUE(`conversation_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`type` enum('direct','group') NOT NULL DEFAULT 'direct',
	`direct_key` varchar(80),
	`expiration_mode` varchar(16) NOT NULL DEFAULT '24h',
	`name` varchar(128),
	`description` varchar(512),
	`avatar_url` text,
	`created_by` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversations_direct_key_unique` UNIQUE(`direct_key`)
);
--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`emoji` varchar(16) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reaction` UNIQUE(`message_id`,`user_id`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `message_receipts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`delivered_at` timestamp,
	`viewed_at` timestamp,
	`expires_at` timestamp,
	`consumed_at` timestamp,
	CONSTRAINT `message_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_receipt_pair` UNIQUE(`message_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`sender_id` bigint unsigned NOT NULL,
	`type` enum('text','image','video','audio','document','location','contact','gif','sticker','call') NOT NULL DEFAULT 'text',
	`content` text,
	`media_url` text,
	`media_meta` text,
	`reply_to_id` bigint unsigned,
	`expiration_mode` varchar(16) NOT NULL DEFAULT '24h',
	`retention_deadline` timestamp NOT NULL,
	`edited_at` timestamp,
	`deleted_for_everyone` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phone_verifications` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`otp_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`last_sent_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phone_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `phone_verifications_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`last_used_at` timestamp,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `starred_messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `starred_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_star` UNIQUE(`user_id`,`message_id`)
);
--> statement-breakpoint
CREATE TABLE `status_views` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`status_id` bigint unsigned NOT NULL,
	`viewer_id` bigint unsigned NOT NULL,
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `status_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_status_view` UNIQUE(`status_id`,`viewer_id`)
);
--> statement-breakpoint
CREATE TABLE `statuses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`type` enum('text','image','video') NOT NULL DEFAULT 'text',
	`content` text,
	`media_url` text,
	`bg_color` varchar(16) DEFAULT '#38BDF8',
	`privacy` enum('contacts','except','only') NOT NULL DEFAULT 'contacts',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `statuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `typing_states` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `typing_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_typing` UNIQUE(`conversation_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`phone` varchar(32),
	`email` varchar(254),
	`password_hash` varchar(255),
	`username` varchar(32),
	`country_code` varchar(8) NOT NULL DEFAULT '+1',
	`name` varchar(128) NOT NULL DEFAULT '',
	`avatar_url` text,
	`about` varchar(512) NOT NULL DEFAULT 'Hey there! I am using Quick Chat.',
	`last_seen_at` timestamp,
	`privacy` text,
	`notify_settings` text,
	`profile_complete` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_phone_unique` UNIQUE(`phone`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE INDEX `idx_signals_call` ON `call_signals` (`call_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_calls_caller` ON `calls` (`caller_id`);--> statement-breakpoint
CREATE INDEX `idx_calls_callee` ON `calls` (`callee_id`);--> statement-breakpoint
CREATE INDEX `idx_cp_user` ON `conversation_participants` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cp_expires` ON `conversation_participants` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_conv_direct_key` ON `conversations` (`direct_key`);--> statement-breakpoint
CREATE INDEX `idx_react_msg` ON `message_reactions` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_receipt_expiry` ON `message_receipts` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_msg_conv_created` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_msg_sender` ON `messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX `idx_msg_retention` ON `messages` (`retention_deadline`);--> statement-breakpoint
CREATE INDEX `idx_pv_phone` ON `phone_verifications` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_token` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_status_user` ON `statuses` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_status_expires` ON `statuses` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_users_phone` ON `users` (`phone`);