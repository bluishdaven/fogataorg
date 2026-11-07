-- Continue reading was removed (owner approved deleting the saved places): drop the table.
DROP POLICY "reading_positions_select_own" ON "reading_positions" CASCADE;--> statement-breakpoint
DROP POLICY "reading_positions_insert_own" ON "reading_positions" CASCADE;--> statement-breakpoint
DROP POLICY "reading_positions_update_own" ON "reading_positions" CASCADE;--> statement-breakpoint
DROP POLICY "reading_positions_delete_own" ON "reading_positions" CASCADE;--> statement-breakpoint
DROP TABLE "reading_positions" CASCADE;