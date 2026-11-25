import pathlib
import sqlite3
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "social-api" / "migrations" / "0001_init.sql"
ACCOUNT_MIGRATION = ROOT / "social-api" / "migrations" / "0002_accounts_passwords_reposts.sql"
NOTIFICATION_MIGRATION = ROOT / "social-api" / "migrations" / "0003_social_notifications.sql"
OWNER_PROFILE_MIGRATION = ROOT / "social-api" / "migrations" / "0004_owner_profiles.sql"
OWNER_NETWORK_ID_MIGRATION = ROOT / "social-api" / "migrations" / "0005_owner_profile_network_identity.sql"

with tempfile.NamedTemporaryFile(suffix=".sqlite") as file:
    connection = sqlite3.connect(file.name)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(MIGRATION.read_text(encoding="utf-8"))
    connection.executescript(ACCOUNT_MIGRATION.read_text(encoding="utf-8"))
    connection.executescript(NOTIFICATION_MIGRATION.read_text(encoding="utf-8"))
    connection.executescript(OWNER_PROFILE_MIGRATION.read_text(encoding="utf-8"))
    connection.executescript(OWNER_NETWORK_ID_MIGRATION.read_text(encoding="utf-8"))

    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'social_%'"
        )
    }
    expected = {
        "social_auth_nonces",
        "social_sessions",
        "social_profiles",
        "social_media_objects",
        "social_posts",
        "social_likes",
        "social_follows",
        "social_challenges",
        "social_challenge_submissions",
        "social_challenge_votes",
        "social_reports",
        "social_rate_limits",
        "social_password_recovery_nonces",
        "social_reposts",
        "social_notifications",
    }
    assert expected.issubset(tables), f"Missing Social tables: {expected - tables}"

    profile_columns = {row[1] for row in connection.execute("PRAGMA table_info(social_profiles)")}
    session_columns = {row[1] for row in connection.execute("PRAGMA table_info(social_sessions)")}
    assert {"password_hash", "password_salt", "password_iterations"}.issubset(profile_columns)
    assert "password_verified" in session_columns

    owner_tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'owner_profile_%'"
        )
    }
    expected_owner_tables = {
        "owner_profiles",
        "owner_profile_wallets",
        "owner_profile_nonces",
        "owner_profile_proofs",
        "owner_profile_sessions",
    }
    assert expected_owner_tables.issubset(owner_tables), (
        f"Missing Owner Profile tables: {expected_owner_tables - owner_tables}"
    )

    owner_profile_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(owner_profiles)")
    }
    assert "network_owner_id" in owner_profile_columns, (
        "Owner Profiles must store the immutable Network Owner ID for wallet changes"
    )
    owner_indexes = {
        row[1] for row in connection.execute("PRAGMA index_list(owner_profiles)")
    }
    assert "idx_owner_profiles_network_owner_id" in owner_indexes, (
        "Network Owner ID must be unique across Owner Profiles"
    )

    # Only verified wallet/account metadata is stored: never genealogy nodes or descendants.
    genealogy_tables = {
        name for name in owner_tables
        if "genealogy" in name.lower() or "tree" in name.lower() or "descendant" in name.lower()
    }
    assert not genealogy_tables, f"Genealogy data must not be persisted: {genealogy_tables}"

    primary_wallet = "0x" + "5" * 40
    secondary_wallet = "0x" + "6" * 40
    connection.execute(
        "INSERT INTO owner_profiles(profile_id,username,password_hash,password_salt,password_iterations,primary_wallet_address,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?,?,?)",
        ("owner-profile-a", "owneralpha", "hash-a", "salt-a", 100000, primary_wallet, 1, 1),
    )
    connection.execute(
        "INSERT INTO owner_profile_wallets(wallet_address,profile_id,is_primary,added_at) VALUES(?,?,1,?)",
        (primary_wallet, "owner-profile-a", 1),
    )
    connection.execute(
        "INSERT INTO owner_profile_wallets(wallet_address,profile_id,is_primary,added_at) VALUES(?,?,0,?)",
        (secondary_wallet, "owner-profile-a", 2),
    )
    connection.execute(
        "UPDATE owner_profiles SET network_owner_id=? WHERE profile_id=?",
        (7421, "owner-profile-a"),
    )
    try:
        connection.execute(
            "INSERT INTO owner_profiles(profile_id,username,password_hash,password_salt,password_iterations,primary_wallet_address,network_owner_id,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            ("owner-profile-ownerid-duplicate", "owneriddup", "hash-c", "salt-c", 100000,
             "0x" + "8" * 40, 7421, 1, 1),
        )
        raise AssertionError("One Network Owner ID cannot belong to multiple Owner Profiles")
    except sqlite3.IntegrityError:
        pass

    # A profile can link several independently verified Network Owner wallets.
    third_wallet = "0x" + "7" * 40
    connection.execute(
        "INSERT INTO owner_profile_wallets(wallet_address,profile_id,is_primary,added_at) VALUES(?,?,0,?)",
        (third_wallet, "owner-profile-a", 3),
    )
    linked_count = connection.execute(
        "SELECT COUNT(*) FROM owner_profile_wallets WHERE profile_id='owner-profile-a'"
    ).fetchone()[0]
    assert linked_count == 3, "Additional verified wallets must be linkable to one profile"

    try:
        connection.execute(
            "INSERT INTO owner_profile_wallets(wallet_address,profile_id,is_primary,added_at) VALUES(?,?,0,?)",
            (secondary_wallet, "owner-profile-a", 4),
        )
        raise AssertionError("A wallet cannot be linked twice")
    except sqlite3.IntegrityError:
        pass

    try:
        connection.execute(
            "INSERT INTO owner_profiles(profile_id,username,password_hash,password_salt,password_iterations,primary_wallet_address,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?,?,?)",
            ("owner-profile-b", "OWNERALPHA", "hash-b", "salt-b", 100000, "0x" + "8" * 40, 1, 1),
        )
        raise AssertionError("Owner Profile usernames must be unique regardless of case")
    except sqlite3.IntegrityError:
        pass

    # Removing the primary wallet promotes the next remaining verified wallet.
    connection.execute(
        "DELETE FROM owner_profile_wallets WHERE wallet_address=? AND profile_id=?",
        (primary_wallet, "owner-profile-a"),
    )
    connection.execute(
        "UPDATE owner_profile_wallets SET is_primary=0 WHERE profile_id=?",
        ("owner-profile-a",),
    )
    connection.execute(
        "UPDATE owner_profile_wallets SET is_primary=1 WHERE wallet_address=? AND profile_id=?",
        (secondary_wallet, "owner-profile-a"),
    )
    connection.execute(
        "UPDATE owner_profiles SET primary_wallet_address=?,network_owner_id=NULL WHERE profile_id=?",
        (secondary_wallet, "owner-profile-a"),
    )
    promoted = connection.execute(
        "SELECT p.primary_wallet_address,w.wallet_address,w.is_primary "
        "FROM owner_profiles p JOIN owner_profile_wallets w "
        "ON w.profile_id=p.profile_id AND w.is_primary=1 "
        "WHERE p.profile_id='owner-profile-a'"
    ).fetchone()
    assert promoted == (secondary_wallet, secondary_wallet, 1), (
        "Removing the primary wallet must promote a remaining linked wallet"
    )

    # Removing another secondary wallet leaves the profile's new primary untouched.
    connection.execute(
        "DELETE FROM owner_profile_wallets WHERE wallet_address=? AND profile_id=?",
        (third_wallet, "owner-profile-a"),
    )
    remaining = connection.execute(
        "SELECT COUNT(*) FROM owner_profile_wallets WHERE profile_id='owner-profile-a'"
    ).fetchone()[0]
    assert remaining == 1, "Wallet removal must preserve the other linked wallet"
    assert connection.execute(
        "SELECT primary_wallet_address FROM owner_profiles WHERE profile_id='owner-profile-a'"
    ).fetchone()[0] == secondary_wallet, "Wallet removal changed the wrong primary address"

    seeded = connection.execute(
        "SELECT COUNT(*) FROM social_challenges WHERE status='active'"
    ).fetchone()[0]
    assert seeded == 2, f"Expected two initial weekly challenges, found {seeded}"

    creator_a = "0x" + "1" * 40
    creator_b = "0x" + "2" * 40
    voter = "0x" + "3" * 40
    for address, handle in ((creator_a, "creatorone"), (creator_b, "creatortwo")):
        connection.execute(
            "INSERT INTO social_profiles(wallet_address,handle,display_name,language,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?)",
            (address, handle, handle, "en", 1, 1),
        )

    # Handles are case-insensitive and cannot be claimed twice.
    try:
        connection.execute(
            "INSERT INTO social_profiles(wallet_address,handle,display_name,language,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?)",
            ("0x" + "4" * 40, "CREATORONE", "Duplicate", "en", 1, 1),
        )
        raise AssertionError("Case-insensitive unique handle constraint was not enforced")
    except sqlite3.IntegrityError:
        pass

    challenge_id = "city-of-tomorrow-2026-w48"
    for post_id, address in (("schema-post-a", creator_a), ("schema-post-b", creator_b)):
        connection.execute(
            "INSERT INTO social_posts(post_id,wallet_address,title,media_type,status,moderation_state,created_at,updated_at) "
            "VALUES(?,?,?,'prompt','published','clear',1,1)",
            (post_id, address, post_id),
        )
        connection.execute(
            "INSERT INTO social_challenge_submissions(challenge_id,post_id,wallet_address,created_at) "
            "VALUES(?,?,?,1)",
            (challenge_id, post_id, address),
        )

    connection.execute(
        "INSERT INTO social_challenge_votes(challenge_id,post_id,voter_wallet,created_at) VALUES(?,?,?,1)",
        (challenge_id, "schema-post-a", voter),
    )
    try:
        connection.execute(
            "INSERT INTO social_challenge_votes(challenge_id,post_id,voter_wallet,created_at) VALUES(?,?,?,2)",
            (challenge_id, "schema-post-b", voter),
        )
        raise AssertionError("One-vote-per-challenge constraint was not enforced")
    except sqlite3.IntegrityError:
        pass

    connection.execute(
        "INSERT INTO social_follows(follower_wallet,following_wallet,created_at) VALUES(?,?,1)",
        (voter, creator_a),
    )
    connection.execute(
        "INSERT INTO social_likes(post_id,wallet_address,created_at) VALUES(?,?,1)",
        ("schema-post-a", voter),
    )

    # A repost references the original post and preserves the original author's record.
    connection.execute(
        "INSERT INTO social_reposts(repost_id,post_id,wallet_address,created_at) VALUES(?,?,?,1)",
        ("repost-a", "schema-post-a", creator_b),
    )
    repost = connection.execute(
        "SELECT p.wallet_address,p.title,r.wallet_address FROM social_posts p "
        "JOIN social_reposts r ON r.post_id=p.post_id WHERE r.repost_id='repost-a'"
    ).fetchone()
    assert repost == (creator_a, "schema-post-a", creator_b), "Repost did not preserve original post identity"
    try:
        connection.execute(
            "INSERT INTO social_reposts(repost_id,post_id,wallet_address,created_at) VALUES(?,?,?,2)",
            ("repost-duplicate", "schema-post-a", creator_b),
        )
        raise AssertionError("Duplicate repost constraint was not enforced")
    except sqlite3.IntegrityError:
        pass

    # Follow, like and repost events have recipient-owned notifications.
    connection.execute(
        "INSERT INTO social_notifications(notification_id,recipient_wallet,actor_wallet,notification_type,post_id,created_at) "
        "VALUES(?,?,?,?,NULL,?)",
        ("notification-follow", creator_a, creator_b, "follow", 2),
    )
    connection.execute(
        "INSERT INTO social_notifications(notification_id,recipient_wallet,actor_wallet,notification_type,post_id,created_at) "
        "VALUES(?,?,?,?,?,?)",
        ("notification-like", creator_a, creator_b, "like", "schema-post-a", 3),
    )
    notification_count = connection.execute(
        "SELECT COUNT(*) FROM social_notifications WHERE recipient_wallet=?", (creator_a,)
    ).fetchone()[0]
    assert notification_count == 2, "Follow/like notifications were not stored"

    connection.execute(
        "INSERT INTO social_password_recovery_nonces(nonce,wallet_address,message,created_at,expires_at) "
        "VALUES(?,?,?,?,?)",
        ("recovery-smoke", creator_a, "signed recovery challenge", 10, 310),
    )

    creator_rows = connection.execute(
        "SELECT p.wallet_address,p.handle,p.display_name,p.bio,p.created_at,"
        "(SELECT COUNT(*) FROM social_posts s WHERE s.wallet_address=p.wallet_address AND s.status='published') AS post_count,"
        "(SELECT COUNT(*) FROM social_follows f WHERE f.following_wallet=p.wallet_address) AS follower_count,"
        "(SELECT COUNT(*) FROM social_follows f WHERE f.follower_wallet=p.wallet_address) AS following_count,"
        "(SELECT COUNT(*) FROM social_likes l JOIN social_posts s ON s.post_id=l.post_id WHERE s.wallet_address=p.wallet_address AND s.status='published') AS appreciation_count,"
        "CASE WHEN ? <> '' AND EXISTS(SELECT 1 FROM social_follows vf WHERE vf.follower_wallet=? AND vf.following_wallet=p.wallet_address) THEN 1 ELSE 0 END AS following_by_me "
        "FROM social_profiles p ORDER BY follower_count DESC,appreciation_count DESC,p.created_at ASC LIMIT ?",
        (voter, voter, 20),
    ).fetchall()
    assert any(row[0] == creator_a and row[-1] == 1 for row in creator_rows), "Creator follow-state query failed"

    challenge_rows = connection.execute(
        "SELECT p.post_id,p.wallet_address,p.title,p.media_type,p.description,p.prompt,p.media_key,p.source_post_id,p.source_wallet,p.source_title,p.created_at,pr.handle,pr.display_name,"
        "(SELECT COUNT(*) FROM social_challenge_votes v WHERE v.challenge_id=? AND v.post_id=p.post_id) AS vote_count,"
        "CASE WHEN ? <> '' AND EXISTS(SELECT 1 FROM social_challenge_votes mv WHERE mv.challenge_id=? AND mv.voter_wallet=?) THEN 1 ELSE 0 END AS voted_by_me "
        "FROM social_challenge_submissions s JOIN social_posts p ON p.post_id=s.post_id "
        "JOIN social_profiles pr ON pr.wallet_address=p.wallet_address "
        "WHERE s.challenge_id=? AND p.status='published' AND p.moderation_state='clear' "
        "ORDER BY vote_count DESC,p.created_at DESC LIMIT 40",
        (challenge_id, voter, challenge_id, voter, challenge_id),
    ).fetchall()
    assert len(challenge_rows) == 2, "Challenge entries query did not return the seeded entries"
    assert all(row[-1] == 1 for row in challenge_rows), "Voted-by-me challenge query failed"
    assert challenge_rows[0][0] == "schema-post-a" and challenge_rows[0][-2] == 1, "Challenge vote count query failed"

    try:
        connection.execute(
            "INSERT INTO social_likes(post_id,wallet_address,created_at) VALUES('missing-post',?,1)",
            (voter,),
        )
        raise AssertionError("Post foreign-key constraint was not enforced")
    except sqlite3.IntegrityError:
        pass

    connection.close()

print("Social D1 migration schema smoke test passed.")
print("Verified all 15 Social tables, password/session columns, recovery nonce storage, notifications, case-insensitive handles, attributed unique reposts, and existing legacy constraints.")
