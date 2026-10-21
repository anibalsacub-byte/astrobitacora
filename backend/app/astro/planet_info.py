"""Datos astronómicos educativos.

Fuente: NASA Goddard Space Flight Center, "Planetary Fact Sheet" y "Sun/Moon/Pluto Fact Sheet"
(https://nssdc.gsfc.nasa.gov/planetary/factsheet/). Periodos siderales.
Un periodo de rotación negativo indica rotación retrógrada física (sentido contrario a la órbita),
que NO es lo mismo que el movimiento retrógrado aparente visto desde la Tierra.
"""

SOURCE = "NASA GSFC – Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet)"

PLANETS = [
    {
        "key": "sun", "name": "Sol", "symbol": "☉", "kind": "Estrella",
        "orbit": "≈ 230 millones de años alrededor del centro galáctico (no orbita el Sol)",
        "orbit_days": None,
        "rotation": "≈ 25,4 días en el ecuador (≈ 35 días cerca de los polos)",
        "rotation_hours": 609.12, "physical_retrograde": False,
        "description": "Estrella enana amarilla de tipo G2V que contiene el 99,8 % de la masa del Sistema Solar. "
                       "Su rotación es diferencial: el ecuador gira más rápido que los polos.",
    },
    {
        "key": "moon", "name": "Luna", "symbol": "☽", "kind": "Satélite natural",
        "orbit": "27,32 días alrededor de la Tierra (mes sideral); 29,53 días entre lunas nuevas",
        "orbit_days": 27.3217,
        "rotation": "27,32 días (rotación sincrónica: siempre muestra la misma cara)",
        "rotation_hours": 655.728, "physical_retrograde": False,
        "description": "Único satélite natural de la Tierra. Su órbita está inclinada unos 5,1° respecto a la eclíptica; "
                       "los puntos de cruce son los nodos lunares.",
    },
    {
        "key": "mercury", "name": "Mercurio", "symbol": "☿", "kind": "Planeta rocoso",
        "orbit": "87,97 días", "orbit_days": 87.969,
        "rotation": "58,65 días", "rotation_hours": 1407.6, "physical_retrograde": False,
        "description": "El planeta más cercano al Sol y el más pequeño. Rota tres veces por cada dos órbitas.",
    },
    {
        "key": "venus", "name": "Venus", "symbol": "♀", "kind": "Planeta rocoso",
        "orbit": "224,70 días", "orbit_days": 224.701,
        "rotation": "243,0 días, retrógrada", "rotation_hours": -5832.5, "physical_retrograde": True,
        "description": "Tiene una atmósfera densa de dióxido de carbono. Gira en sentido contrario a casi todos los planetas.",
    },
    {
        "key": "earth", "name": "Tierra", "symbol": "⊕", "kind": "Planeta rocoso",
        "orbit": "365,26 días (1 año)", "orbit_days": 365.256,
        "rotation": "23 h 56 min (día sideral)", "rotation_hours": 23.9345, "physical_retrograde": False,
        "description": "Completa una vuelta alrededor del Sol en un año, base de nuestro calendario. "
                       "Es el punto de observación de todas las posiciones geocéntricas de la carta.",
    },
    {
        "key": "mars", "name": "Marte", "symbol": "♂", "kind": "Planeta rocoso",
        "orbit": "686,98 días (1,88 años)", "orbit_days": 686.980,
        "rotation": "24 h 37 min", "rotation_hours": 24.6229, "physical_retrograde": False,
        "description": "Planeta rojo por el óxido de hierro de su superficie. Tiene dos lunas pequeñas, Fobos y Deimos.",
    },
    {
        "key": "jupiter", "name": "Júpiter", "symbol": "♃", "kind": "Gigante gaseoso",
        "orbit": "11,86 años", "orbit_days": 4332.589,
        "rotation": "9 h 55 min", "rotation_hours": 9.9250, "physical_retrograde": False,
        "description": "El planeta más grande del Sistema Solar; su masa supera a la de todos los demás juntos.",
    },
    {
        "key": "saturn", "name": "Saturno", "symbol": "♄", "kind": "Gigante gaseoso",
        "orbit": "29,46 años", "orbit_days": 10759.22,
        "rotation": "10 h 39 min", "rotation_hours": 10.656, "physical_retrograde": False,
        "description": "Conocido por su sistema de anillos de hielo y roca. Su densidad media es menor que la del agua.",
    },
    {
        "key": "uranus", "name": "Urano", "symbol": "♅", "kind": "Gigante helado",
        "orbit": "84,01 años", "orbit_days": 30685.4,
        "rotation": "17 h 14 min, retrógrada", "rotation_hours": -17.24, "physical_retrograde": True,
        "description": "Su eje está inclinado unos 98°, por lo que prácticamente rueda sobre su órbita.",
    },
    {
        "key": "neptune", "name": "Neptuno", "symbol": "♆", "kind": "Gigante helado",
        "orbit": "164,8 años", "orbit_days": 60189.0,
        "rotation": "16 h 07 min", "rotation_hours": 16.11, "physical_retrograde": False,
        "description": "El planeta más lejano del Sol; fue descubierto en 1846 a partir de predicciones matemáticas.",
    },
    {
        "key": "pluto", "name": "Plutón", "symbol": "♇", "kind": "Planeta enano",
        "orbit": "247,9 años", "orbit_days": 90560.0,
        "rotation": "6,39 días, retrógrada", "rotation_hours": -153.2928, "physical_retrograde": True,
        "description": "Clasificado como planeta enano por la UAI desde 2006. Forma un sistema doble con su luna Caronte.",
    },
]

NODES_NOTE = (
    "Los nodos lunares (Rahu y Ketu en la tradición védica) no son cuerpos físicos: son los dos puntos donde la "
    "órbita de la Luna cruza la eclíptica. Su movimiento medio es retrógrado, con un ciclo de unos 18,6 años."
)
