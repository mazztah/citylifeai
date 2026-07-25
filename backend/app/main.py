from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/")
def root():
    return {"status": "ok", "service": "citylife-ai-backend"}


@app.get("/health")
def health():
    return {"status": "healthy"}
