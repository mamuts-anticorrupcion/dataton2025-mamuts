# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.timeline import router as timeline_router

app = FastAPI(title="Datatón API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(timeline_router)

@app.get("/")
def root():
    return {"mensaje": "Servidor Datatón activo 🚀"}
