"""Registro de demostración, claramente identificado. Se crea una sola vez y puede borrarse."""
from sqlalchemy.orm import Session

from .db import Setting
from .schemas import AstroConfig, Moment, Personal
from .services import create_entry


def seed_demo(db: Session) -> None:
    if db.get(Setting, "demo_seeded"):
        return
    create_entry(
        db,
        Moment(
            local_datetime="2024-04-08T11:07",
            timezone="America/Mazatlan",
            location_name="Mazatlán, Sinaloa, México",
            latitude=23.2494,
            longitude=-106.4111,
        ),
        AstroConfig(),
        Personal(
            mood=5,
            emotions=["Alegría", "Entusiasmo", "Gratitud"],
            intensity=9,
            what_happened="[DEMOSTRACIÓN] Registro de ejemplo: observación del eclipse total de Sol del 8 de abril de 2024.",
            how_felt="[DEMOSTRACIÓN] Texto ficticio para mostrar cómo se ve una entrada. Puedes borrarla desde el calendario.",
            special="[DEMOSTRACIÓN] Totalidad visible durante unos 4 minutos.",
            special_valence="positivo",
            tags=["viajes", "demostración"],
            sleep_hours=6.5,
            energy=8,
            stress=3,
            notes="Las posiciones astronómicas de esta entrada son reales; el contenido personal es ficticio.",
        ),
        is_demo=True,
    )
    db.add(Setting(key="demo_seeded", value=True))
    db.commit()
