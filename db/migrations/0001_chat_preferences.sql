ALTER TABLE `conversation_participants` ADD `favorite` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE `user_reports` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `reporter_id` bigint unsigned NOT NULL,
 `reported_id` bigint unsigned NOT NULL,
 `reason` varchar(1000) NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `user_reports_id` PRIMARY KEY (`id`),
 CONSTRAINT `uq_report_pair` UNIQUE (`reporter_id`,`reported_id`)
);
