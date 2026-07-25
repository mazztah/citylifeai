"""
Minimaler End-to-End-Test: Login -> Missionen holen -> Mission abschließen -> Story pruefen.
Ausfuehren mit: pytest (im backend/-Verzeichnis)
"""


def test_login_creates_player(client):
    resp = client.post("/players/login", json={"dev_telegram_id": 12345, "dev_username": "tester"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["telegram_id"] == 12345
    assert data["level"] == 1
    assert data["cash"] == 1500


def test_missions_and_story_flow(client):
    login_resp = client.post("/players/login", json={"dev_telegram_id": 999, "dev_username": "story_tester"})
    player_id = login_resp.json()["id"]

    missions_resp = client.get(f"/missions/{player_id}/active")
    assert missions_resp.status_code == 200
    missions = missions_resp.json()
    assert len(missions) >= 1
    story_missions = [m for m in missions if m["category"] == "story"]
    assert story_missions[0]["story_chapter_id"] == "chapter_01"

    complete_resp = client.post(
        f"/missions/{player_id}/complete", json={"mission_id": story_missions[0]["id"]}
    )
    assert complete_resp.status_code == 200
    assert complete_resp.json()["xp"] > 0

    story_resp = client.get(f"/story/{player_id}/current")
    assert story_resp.status_code == 200
    assert story_resp.json()["current_chapter"]["id"] == "chapter_01"


def test_world_state_available(client):
    login_resp = client.post("/players/login", json={"dev_telegram_id": 555})
    player_id = login_resp.json()["id"]
    world_resp = client.get(f"/world/{player_id}/state")
    assert world_resp.status_code == 200
    assert world_resp.json()["city_id"] == "hannover"
