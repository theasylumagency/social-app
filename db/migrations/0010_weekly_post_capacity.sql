ALTER TABLE weekly_post_assets DROP CONSTRAINT weekly_post_assets_post_key_check;
ALTER TABLE weekly_post_assets ADD CONSTRAINT weekly_post_assets_post_key_check CHECK(post_key ~ '^p([1-9]|10)$');
