-- Dedicated Social QA demo data. This file is applied only to fly-social-qa-db.
-- Re-running the QA workflow resets the test accounts and sample content deterministically.
PRAGMA foreign_keys = ON;
DELETE FROM social_notifications;
DELETE FROM social_reposts;
DELETE FROM social_likes;
DELETE FROM social_follows;
DELETE FROM social_posts;
DELETE FROM social_media_objects;
DELETE FROM social_password_recovery_nonces;
DELETE FROM social_sessions;
DELETE FROM social_auth_nonces;
DELETE FROM social_rate_limits;
DELETE FROM social_profiles;

INSERT INTO social_profiles(wallet_address,handle,display_name,bio,language,created_at,updated_at) VALUES
('0x1111111111111111111111111111111111111111','flytester','Fly QA Tester','This is an isolated demo profile. All content here is synthetic.','en',CAST(strftime('%s','now') AS INTEGER)-10000,CAST(strftime('%s','now') AS INTEGER)),
('0x2222222222222222222222222222222222222222','alicegreen','Alice Green','Digital artist exploring future worlds.','en',CAST(strftime('%s','now') AS INTEGER)-9000,CAST(strftime('%s','now') AS INTEGER)),
('0x3333333333333333333333333333333333333333','bobcreator','Bob Creator','Sharing creative experiments and visual stories.','en',CAST(strftime('%s','now') AS INTEGER)-8000,CAST(strftime('%s','now') AS INTEGER)),
('0x4444444444444444444444444444444444444444','carolstudio','Carol Studio','Community builder and creative technologist.','en',CAST(strftime('%s','now') AS INTEGER)-7000,CAST(strftime('%s','now') AS INTEGER)),
('0x5555555555555555555555555555555555555555','davidpixels','David Pixels','Small details, big ideas.','en',CAST(strftime('%s','now') AS INTEGER)-6000,CAST(strftime('%s','now') AS INTEGER));

INSERT INTO social_posts(post_id,wallet_address,title,media_type,description,prompt,media_key,source_post_id,source_wallet,source_title,status,moderation_state,created_at,updated_at) VALUES
('qa-post-own-1','0x1111111111111111111111111111111111111111','Welcome to the QA feed','image','Welcome to the Fly Infinity Social test space. This post belongs to the demo account.','',NULL,NULL,NULL,NULL,'published','clear',CAST(strftime('%s','now') AS INTEGER)-180,CAST(strftime('%s','now') AS INTEGER)-180),
('qa-post-own-2','0x1111111111111111111111111111111111111111','A second demo post','image','Testing long post cards, actions, and responsive spacing with synthetic content.','',NULL,NULL,NULL,NULL,'published','clear',CAST(strftime('%s','now') AS INTEGER)-3600,CAST(strftime('%s','now') AS INTEGER)-3600),
('qa-post-alice-1','0x2222222222222222222222222222222222222222','Future city concept','image','A bright green city concept for a future community.','',NULL,NULL,NULL,NULL,'published','clear',CAST(strftime('%s','now') AS INTEGER)-600,CAST(strftime('%s','now') AS INTEGER)-600),
('qa-post-alice-2','0x2222222222222222222222222222222222222222','Creative process','image','A short note about experimentation, iteration, and sharing ideas.','',NULL,NULL,NULL,NULL,'published','clear',CAST(strftime('%s','now') AS INTEGER)-7200,CAST(strftime('%s','now') AS INTEGER)-7200),
('qa-post-bob-1','0x3333333333333333333333333333333333333333','A visual experiment','image','Exploring gradients, glass panels, and soft ambient light.','',NULL,NULL,NULL,NULL,'published','clear',CAST(strftime('%s','now') AS INTEGER)-900,CAST(strftime('%s','now') AS INTEGER)-900),
('qa-post-carol-1','0x4444444444444444444444444444444444444444','Community update','image','A sample community update for testing notifications and social connections.','',NULL,NULL,NULL,NULL,'published','clear',CAST(strftime('%s','now') AS INTEGER)-1500,CAST(strftime('%s','now') AS INTEGER)-1500),
('qa-post-david-1','0x5555555555555555555555555555555555555555','Design notes','image','A synthetic post to populate Explore with a fifth creator.','',NULL,NULL,NULL,NULL,'published','clear',CAST(strftime('%s','now') AS INTEGER)-2400,CAST(strftime('%s','now') AS INTEGER)-2400);

INSERT INTO social_follows(follower_wallet,following_wallet,created_at) VALUES
('0x1111111111111111111111111111111111111111','0x2222222222222222222222222222222222222222',CAST(strftime('%s','now') AS INTEGER)-5000),
('0x3333333333333333333333333333333333333333','0x1111111111111111111111111111111111111111',CAST(strftime('%s','now') AS INTEGER)-4500),
('0x4444444444444444444444444444444444444444','0x1111111111111111111111111111111111111111',CAST(strftime('%s','now') AS INTEGER)-4000),
('0x5555555555555555555555555555555555555555','0x2222222222222222222222222222222222222222',CAST(strftime('%s','now') AS INTEGER)-3500);

INSERT INTO social_likes(post_id,wallet_address,created_at) VALUES
('qa-post-own-1','0x2222222222222222222222222222222222222222',CAST(strftime('%s','now') AS INTEGER)-2500),
('qa-post-own-1','0x3333333333333333333333333333333333333333',CAST(strftime('%s','now') AS INTEGER)-2300),
('qa-post-alice-1','0x1111111111111111111111111111111111111111',CAST(strftime('%s','now') AS INTEGER)-2000),
('qa-post-bob-1','0x4444444444444444444444444444444444444444',CAST(strftime('%s','now') AS INTEGER)-1700);

INSERT INTO social_reposts(repost_id,post_id,wallet_address,created_at) VALUES
('qa-repost-alice-own2','qa-post-own-2','0x2222222222222222222222222222222222222222',CAST(strftime('%s','now') AS INTEGER)-1200),
('qa-repost-david-alice1','qa-post-alice-1','0x5555555555555555555555555555555555555555',CAST(strftime('%s','now') AS INTEGER)-900);

INSERT INTO social_notifications(notification_id,recipient_wallet,actor_wallet,notification_type,post_id,created_at,read_at) VALUES
('qa-note-follow-bob','0x1111111111111111111111111111111111111111','0x3333333333333333333333333333333333333333','follow',NULL,CAST(strftime('%s','now') AS INTEGER)-800,NULL),
('qa-note-follow-carol','0x1111111111111111111111111111111111111111','0x4444444444444444444444444444444444444444','follow',NULL,CAST(strftime('%s','now') AS INTEGER)-700,NULL),
('qa-note-like-alice','0x1111111111111111111111111111111111111111','0x2222222222222222222222222222222222222222','like','qa-post-own-1',CAST(strftime('%s','now') AS INTEGER)-600,NULL),
('qa-note-repost-alice','0x1111111111111111111111111111111111111111','0x2222222222222222222222222222222222222222','repost','qa-post-own-2',CAST(strftime('%s','now') AS INTEGER)-500,NULL);
