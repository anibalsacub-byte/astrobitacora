"""Constantes zodiacales, cuerpos y sistemas soportados."""
import swisseph as swe

# (clave, nombre tropical/occidental, símbolo, nombre védico / rashi)
SIGNS = [
    ("aries", "Aries", "♈", "Mesha"),
    ("taurus", "Tauro", "♉", "Vrishabha"),
    ("gemini", "Géminis", "♊", "Mithuna"),
    ("cancer", "Cáncer", "♋", "Karka"),
    ("leo", "Leo", "♌", "Simha"),
    ("virgo", "Virgo", "♍", "Kanya"),
    ("libra", "Libra", "♎", "Tula"),
    ("scorpio", "Escorpio", "♏", "Vrischika"),
    ("sagittarius", "Sagitario", "♐", "Dhanu"),
    ("capricorn", "Capricornio", "♑", "Makara"),
    ("aquarius", "Acuario", "♒", "Kumbha"),
    ("pisces", "Piscis", "♓", "Meena"),
]
SIGN_KEYS = [s[0] for s in SIGNS]

# (clave, id Swiss Ephemeris, nombre, símbolo, abreviatura)
BODIES = [
    ("sun", swe.SUN, "Sol", "☉", "Su"),
    ("moon", swe.MOON, "Luna", "☽", "Lu"),
    ("mercury", swe.MERCURY, "Mercurio", "☿", "Me"),
    ("venus", swe.VENUS, "Venus", "♀", "Ve"),
    ("mars", swe.MARS, "Marte", "♂", "Ma"),
    ("jupiter", swe.JUPITER, "Júpiter", "♃", "Ju"),
    ("saturn", swe.SATURN, "Saturno", "♄", "Sa"),
    ("uranus", swe.URANUS, "Urano", "♅", "Ur"),
    ("neptune", swe.NEPTUNE, "Neptuno", "♆", "Ne"),
    ("pluto", swe.PLUTO, "Plutón", "♇", "Pl"),
]
NODE_IDS = {"mean": swe.MEAN_NODE, "true": swe.TRUE_NODE}
RAHU = ("rahu", "Nodo norte (Rahu)", "☊", "Ra")
KETU = ("ketu", "Nodo sur (Ketu)", "☋", "Ke")
BODY_KEYS = [b[0] for b in BODIES] + ["rahu", "ketu"]

AYANAMSAS = {
    "lahiri": (swe.SIDM_LAHIRI, "Lahiri (Chitrapaksha)"),
    "raman": (swe.SIDM_RAMAN, "Raman"),
    "krishnamurti": (swe.SIDM_KRISHNAMURTI, "Krishnamurti (KP)"),
    "fagan_bradley": (swe.SIDM_FAGAN_BRADLEY, "Fagan/Bradley"),
}

HOUSE_SYSTEMS = {
    "P": "Placidus",
    "W": "Signo entero (Whole Sign)",
    "K": "Koch",
    "E": "Casas iguales",
    "O": "Porfirio",
    "R": "Regiomontano",
    "C": "Campanus",
}
# Sistemas que no pueden calcularse en latitudes circumpolares (|lat| >= 90° - oblicuidad).
POLAR_UNDEFINED = {"P", "K"}

ZODIACS = {"tropical": "Tropical (occidental)", "sidereal": "Sideral (védico)"}

MOON_PHASES = [
    "Luna nueva", "Creciente", "Cuarto creciente", "Gibosa creciente",
    "Luna llena", "Gibosa menguante", "Cuarto menguante", "Menguante",
]
