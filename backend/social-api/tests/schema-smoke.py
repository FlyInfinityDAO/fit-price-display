import pathlib
import sqlite3
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "social-api" / "migrations" / "0001_init.sql"

with tempfile.NamedTemporaryFile(suffix=".sqlite") as file:
    connection = sqlite3.connect(file.name)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(MIGRATION.read_text(encoding="utf-8"))

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
    }
    assert expected.issubset(tables), f"Missing Social tables: {expected - tables}"

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
print("Verified all 12 Social tables, seeded challenges, case-insensitive handles, one vote per wallet per challenge, follow/like/challenge read queries, and post foreign keys.")
