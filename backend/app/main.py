from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from .database import Base, engine
from .routers import players, missions, story, world, leaderboard

# Für dieses Scaffold reicht create_all (SQLite/Postgres beide ok). Für echten
# Produktivbetrieb: Alembic-Migrationen statt create_all verwenden.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CityLife AI Backend",
    description="Missionen, Story-Engine und individuelle Stadtentwicklung für die "
                 "CityLife AI Telegram Mini App.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Produktion auf die Mini-App-Domain einschränken
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(missions.router)
app.include_router(story.router)
app.include_router(world.router)
app.include_router(leaderboard.router)

# Serve static files from the 'static' directory if it exists
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")



# Moved below static files if needed, but static files with html=True handles /


@app.get("/health")
def health():
    return {"status": "healthy"}
