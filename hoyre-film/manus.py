# -*- coding: utf-8 -*-
"""Narration for «Tre vinduer», taken word for word from hoyre-dokumentar/01-manus.md.

Each line: (id, text as displayed in subtitles, pause after in seconds).
`spoken()` turns the display text into what the TTS voice should say (numbers
written out the way 01-manus.md asks for them to be read).

The [STAT NEEDED] sentence in chapter 1 (K8) is left out until Høyre supplies the
number. Add it to line a4 and re-run; every shot re-times itself from the voice.
"""
import re

LINES = [
    # --- Kald åpning --------------------------------------------------------
    ("o1", "Tre vinduer i samme gate, sent på kvelden.", 1.1),
    ("o2", "I det første vinduet sitter en mor ved kjøkkenbordet med telefonen foran seg. "
           "Hun venter på å høre fra sønnen sin.", 1.2),
    ("o3", "I det andre øver en mann på norske gloser etter et skift på lageret. "
           "I morgen har han språkprøve.", 1.2),
    ("o4", "I det tredje lyser en mobil opp på et gutterom. "
           "En melding fra en ukjent konto: «Rask cash. Ett oppdrag.»", 1.4),
    ("o5", "Scenen er sammensatt. Men hvert vindu bygger på mønstre som norske myndigheter selv har beskrevet.", 1.0),
    # --- Ramme --------------------------------------------------------------
    ("r1", "Norge er blant de tryggeste og rikeste landene i verden. "
           "Likevel dør flere hundre mennesker av narkotika her hvert år, "
           "og mange som har kommet hit, står utenfor arbeidslivet.", 0.9),
    ("r2", "Hvorfor er rus og integrering så vanskelig å lykkes med? Vi har sett på tallene.", 1.2),
    # --- Kapittel 1: Rus ----------------------------------------------------
    ("k1", "Det første vinduet.", 1.2),
    ("a1", "I 2024 ble 342 dødsfall i Norge registrert som narkotikautløste. "
           "Året før var tallet det høyeste på over tjue år.", 1.0),
    ("a2", "Nesten seks prosent av voksne mellom 16 og 64 år oppgir å ha brukt cannabis det siste året. "
           "Blant elever i videregående er andelen rundt femten prosent.", 1.0),
    ("a3", "Markedet drives av kriminelle nettverk som politiet beskriver som stadig mer profesjonelle. "
           "Kripos har advart om at Norge i flere saker brukes som transittland for kokain.", 1.0),
    ("a4", "Køen inn til rusbehandling er blitt kortere: 26 dager i snitt i 2025. "
           "Men behandling er bare begynnelsen.", 1.1),
    ("a5", "Hvordan kom vi hit? I 2021 foreslo Solberg-regjeringen en rusreform: "
           "hjelp i stedet for straff for bruk og besittelse til eget bruk. Den fikk ikke flertall. "
           "I 2022 slo Høyesterett fast at rusavhengige som tas med små mengder, "
           "i alminnelighet ikke skal få følbar straff.", 0.8),
    ("a6", "Og i 2025 vedtok et flertall på Stortinget, med Høyre, at narkotika fortsatt skal være forbudt, "
           "men at voksne som tas med små mengder, som hovedregel skal få en lav bot.", 1.1),
    ("a7", "Partiene ser ulikt på veien videre. "
           "Arbeiderparti-regjeringen mener forbudet skal stå, men at rusavhengige skal få hjelp i stedet for straff. "
           "Fremskrittspartiet vil ikke avkriminalisere for noen grupper, men tilby behandling som alternativ til straff. "
           "Senterpartiet vil skille tydeligere mellom rusavhengige og andre brukere, og gi politiet flere verktøy. "
           "SV og Venstre har lenge ønsket avkriminalisering, og MDG vil i tillegg ha regulert salg av cannabis.", 1.0),
    ("a8", "Høyre vil at narkotika fortsatt skal være forbudt, og at politiet skal kunne avdekke både bruk og salg. "
           "Men den som tas for eget bruk, skal møtes med hjelp: et obligatorisk møte i kommunens rustjeneste, "
           "med gebyr ved manglende oppmøte. "
           "Høyre vil også styrke tollkontrollen, gjeninnføre fritt behandlingsvalg og bygge ut ettervernet – "
           "så veien ut av rusen faktisk holder.", 1.6),
    # --- Kapittel 2: Innvandring og integrering ----------------------------
    ("k2", "Det andre vinduet.", 1.2),
    ("b1", "Ved inngangen til 2026 bodde det nesten én million innvandrere i Norge – 17,5 prosent av befolkningen. "
           "I tillegg kommer nesten 240 000 som er født her, av to innvandrerforeldre.", 1.0),
    ("b2", "De siste årene har vært preget av krigen i Ukraina. "
           "Bare i 2025 registrerte UDI over 13 000 søknader om kollektiv beskyttelse fra ukrainere, "
           "mens antallet asylsøkere fra andre land har gått ned.", 1.0),
    ("b3", "For kommunene er det en stor oppgave. "
           "I 2024 bosatte de over 25 000 flyktninger – omtrent dobbelt så mange som året etter. "
           "Hver av dem trenger bolig, skoleplass, norskopplæring og en vei inn i arbeid.", 1.0),
    ("b4", "Og arbeid avgjør mye. "
           "I 2025 var 67,5 prosent av innvandrere mellom 20 og 66 år i jobb, mot nær 80 prosent i resten av befolkningen. "
           "Forskjellen mellom kvinner og menn er stor: Ett år etter introduksjonsprogrammet var 75 prosent "
           "av mennene i jobb eller utdanning – men bare 58 prosent av kvinnene.", 1.0),
    ("b5", "Samtidig viser tallene fremgang. Sysselsettingen stiger tydelig med årene i Norge. "
           "Og barna til innvandrere tar høyere utdanning i større grad enn jevnaldrende i resten av befolkningen.", 1.0),
    ("b6", "Partiene vil ulike veier. "
           "Arbeiderparti-regjeringen har strammet inn og foreslått færre kvoteflyktninger, "
           "med henvisning til kommunenes kapasitet. "
           "Fremskrittspartiet har som mål netto null innvandring fra land partiet mener gir store integreringsutfordringer. "
           "SV vil at Norge skal ta imot 5 000 kvoteflyktninger i året, slik FN anbefaler.", 1.0),
    ("b7", "Høyre vil ha en streng, forutsigbar og bærekraftig innvandringspolitikk, "
           "der flyktninger i hovedsak kommer som kvoteflyktninger, og mer av hjelpen gis i nærområdene. "
           "Samtidig vil Høyre stille tydeligere krav: aktivitetsplikt for sosialhjelpsmottakere, "
           "norskopplæring for foreldre som får gratis kjernetid i barnehagen uten å være i jobb, "
           "og strengere norskkrav for å bli statsborger. "
           "Forventninger og muligheter skal gå hånd i hånd.", 1.6),
    # --- Kapittel 3: Trygghet ----------------------------------------------
    ("k3", "Det tredje vinduet.", 1.2),
    ("c1", "Politiets trusselvurdering for 2026 beskriver kriminelle nettverk som spesialiserer seg "
           "og kjøper tjenester av hverandre – også vold. "
           "Kripos har registrert en økning i saker der barn og unge rekrutteres til voldsoppdrag via digitale plattformer.", 1.0),
    ("c2", "Samtidig viser SSBs tall at det ikke er flere unge generelt som begår lovbrudd: "
           "Færre 15–17-åringer ble siktet i 2023 enn i 2018. "
           "Utfordringen er en mindre gruppe som trekkes inn i noe langt mer alvorlig. "
           "Bak mange slike oppdrag står et barn som noen har valgt å utnytte.", 1.1),
    ("c3", "Regjeringen viser til at den har styrket politiet og satset på forebygging. "
           "Høyre vil ha et politi og rettsvesen som forebygger bedre, avdekker mer og gir strengere straffer: "
           "minst tusen nye politifolk ute i distriktene, enklere inndragning av kriminelles verdier, "
           "strengere straff for å utnytte unge i kriminalitet, og raskere reaksjoner når unge begår alvorlige lovbrudd.", 1.6),
    # --- Syntese ------------------------------------------------------------
    ("s1", "Tre vinduer. Tre ulike historier – som henger sammen.", 1.0),
    ("s2", "Politiet beskriver nettverk som tjener penger på narkotika, og som bruker unge til å utføre vold. "
           "En jobb er noe av det beste vernet mot utenforskap – både for den som er ny i landet, "
           "og for den som er på vei ut av rus. "
           "Og trygghet er det som gjør at et åpent samfunn kan forbli åpent.", 1.1),
    ("s3", "Høyres svar har en rød tråd: tydelige regler og konsekvenser for dem som utnytter andre. "
           "Hjelp og oppfølging for dem som sliter med rus. "
           "Og klare forventninger, sammen med reelle muligheter, for alle som skal bygge livet sitt her.", 1.4),
    # --- Avslutning ---------------------------------------------------------
    ("e1", "Tre vinduer i samme gate. Alle fortjener et svar.", 1.4),
    ("e2", "Høyre. Muligheter for alle.", 0.0),
]

# How numbers and abbreviations are read (see «Stemme og regi» in 01-manus.md).
# Longest patterns first.
SPOKEN = [
    ("«", ""), ("»", ""), (" – ", ", "),
    ("15–17-åringer", "femten- til syttenåringer"),
    ("17,5 prosent", "sytten komma fem prosent"),
    ("67,5 prosent", "sekstisju komma fem prosent"),
    ("240 000", "to hundre og førti tusen"),
    ("25 000", "tjuefem tusen"),
    ("13 000", "tretten tusen"),
    ("5 000", "fem tusen"),
    ("16 og 64", "seksten og sekstifire"),
    ("20 og 66", "tjue og sekstiseks"),
    ("2018", "tjue atten"), ("2021", "tjue tjueen"), ("2022", "tjue tjueto"), ("2023", "tjue tjuetre"),
    ("2024", "tjue tjuefire"), ("2025", "tjue tjuefem"), ("2026", "tjue tjueseks"),
    ("342", "tre hundre og førtito"),
    ("26", "tjueseks"), ("80", "åtti"), ("75", "syttifem"), ("58", "femtiåtte"),
    ("cash", "kæsj"), ("UDI", "u de i"), ("SSBs", "es es bes"), ("FN", "eff enn"),
    ("Solberg-regjeringen", "Solberg regjeringen"), ("Arbeiderparti-regjeringen", "Arbeiderparti regjeringen"),
]


def spoken(text):
    out = text
    for a, b in SPOKEN:
        if a[0].isdigit() or a.isupper():
            out = re.sub(r"(?<![\w])" + re.escape(a) + r"(?![\w])", b, out)
        else:
            out = out.replace(a, b)
    return out


def sentences(text):
    """Split a line into sentences (keeps punctuation). A quote counts as one sentence."""
    parts = re.split(r"(?<=[.!?»])\s+(?=[A-ZÆØÅ«])", text.strip())
    out = []
    for p in parts:
        if out and out[-1].count("«") > out[-1].count("»"):
            out[-1] += " " + p
        else:
            out.append(p)
    return out


if __name__ == "__main__":
    words = sum(len(t.split()) for _, t, _ in LINES)
    print(f"{len(LINES)} lines, {words} words")
    for lid, t, _ in LINES:
        for s in sentences(t):
            print(lid, "|", spoken(s))
