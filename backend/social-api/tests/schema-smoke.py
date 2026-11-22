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
print("Verified all 12 Social tables, two seeded challenges, case-insensitive handles, one vote per wallet per challenge, and post foreign keys.")
