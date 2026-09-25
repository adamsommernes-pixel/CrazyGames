# -*- coding: utf-8 -*-
"""Manus: "Dennis" – ett porträtt av Dennis Eriksson.

Varje replik: (id, text, paus efter i sekunder).
Ord inom {klamrar} ersätts med handskrivna fonem (se PRON) för rätt uttal.
"""

PRON = {
    "mariehamn": "[[marˈiːəhˌamn]]",
    "alanning": "[[ˈoːlɛnɪŋ]]",
    "psykiatrin": "[[sykɪatrˈiːn]]",
    "kolen": "[[ɕˈøːlən]]",
    "canis": "[[kˈɑːnɪs]]",
    "lophus": "[[lˈøːphʉːs]]",
    "lupus": "[[lˈʉːpɵs]]",
    "napso": "[[nˈapsʊ]]",
    "julius": "[[jˈʉːlɪɵs]]",
    "ukulele": "[[ʉkɵlˈeːlə]]",
}

LINES = [
    # --- Kall öppning -------------------------------------------------------
    ("o1", "Mitt i Östersjön, mellan Sverige och Finland, ligger Åland.", 0.8),
    ("o2", "Ett land av sten, skog och vatten. Mer än sextusen öar och skär.", 0.8),
    ("o3", "Här bor omkring trettiotusen människor. Det här är berättelsen om en av dem.", 5.0),
    # --- I. Ålänningen ------------------------------------------------------
    ("a1", "Dennis Eriksson är {alanning}. Rakt igenom.", 0.9),
    ("a2", "En man med grått skägg, ett lugnt sätt, och ett stort hjärta.", 0.9),
    ("a3", "Han har arbetat ett helt liv med att hjälpa andra. Han har sprungit mil efter mil. Han har spelat fiol på gator och torg.", 1.0),
    ("a4", "Och han har aldrig, någonsin, riktigt förstått sig på sin mobiltelefon.", 2.6),
    # --- II. Västerut -------------------------------------------------------
    ("b1", "Men vi börjar på andra sidan {kolen}. I Norge.", 0.8),
    ("b2", "Som ung arbetade Dennis inom {psykiatrin} i Norge.", 0.8),
    ("b3", "Det är ett arbete som kräver tålamod. Lugn. Och förmågan att verkligen lyssna.", 0.9),
    ("b4", "Egenskaper som skulle följa med honom, hela vägen hem.", 2.2),
    # --- III. Arbetet -------------------------------------------------------
    ("c1", "Tillbaka på Åland ägnade han en lång karriär åt något som sällan syns i tidningarna.", 0.6),
    ("c2", "Att hjälpa människor ut i arbete.", 1.0),
    ("c3", "Människor som av olika skäl hade hamnat utanför. Som behövde någon som trodde på dem, innan de själva gjorde det.", 0.9),
    ("c4", "Ett samtal i taget. En människa i taget.", 1.1),
    ("c5", "Hur många det blev genom åren är svårt att säga. Men på en liten ö möter man dem överallt. I affären. I hamnen. På caféet.", 0.9),
    ("c6", "I dag är Dennis pensionär, efter ett långt och viktigt arbetsliv.", 2.2),
    # --- IV. Familjen -------------------------------------------------------
    ("d1", "Men det viktigaste har alltid funnits hemma.", 0.8),
    ("d2", "Där finns Ann. Född Granlund, sedan många år Eriksson.", 0.8),
    ("d3", "Tillsammans fick de tre barn. Viktor. Elin. Och Ida.", 0.8),
    ("d4", "Viktor och Elin bor kvar på Åland. Ida bor och arbetar i Stockholm, på andra sidan Ålands hav.", 1.0),
    ("d5", "Sedan kom barnbarnen. Adam. Olle. Tilly. Kalle. Och Sigge.", 1.1),
    ("d6", "Och så finns det en familjemedlem till. En med fyra ben.", 0.7),
    ("d7", "{napso}.", 0.9),
    ("d8", "Alltid redo för en promenad. Eller helst lite mer än så.", 1.8),
    # --- V. Flocken ---------------------------------------------------------
    ("e1", "För Dennis nöjer sig inte med promenader. Han springer.", 0.7),
    ("e2", "I många år har han varit en del av löpargruppen {canis} {lophus}.", 0.8),
    ("e3", "Namnet för tankarna till vargen, {canis} {lupus}. Och precis som vargar, springer de tillsammans. I flock.", 0.8),
    ("e4", "Genom skog, längs stränder, i regn och i motvind.", 0.8),
    ("e5", "Man springer inte ifrån någon. Man springer med varandra.", 2.4),
    # --- VI. Musiken --------------------------------------------------------
    ("f1", "Men om det finns något som verkligen är Dennis, så är det musiken.", 0.8),
    ("f2", "Han spelar fiol. Han spelar gitarr. Och {ukulele}, när andan faller på.", 0.9),
    ("f3", "Musik som inte hör hemma på en scen, utan mitt bland människor.", 1.0),
    ("f4", "{mariehamn}. En sommardag i juli.", 15.6),
    ("f5", "Och när musikens historia ska berättas, står han gärna där framme. Med pekpinnen i hand.", 2.4),
    # --- VII. Tekniken ------------------------------------------------------
    ("g1", "Det finns dock ett område där Dennis inte riktigt är lika hemma.", 0.9),
    ("g2", "Tekniken.", 1.0),
    ("g3", "Hur skickar man en bild? Vart tog appen vägen? Och varför är allt plötsligt så stort på skärmen?", 0.9),
    ("g4", "Genom åren har svaret nästan alltid varit detsamma. Ring Adam.", 0.9),
    ("g5", "Barnbarnet Adam har blivit hans alldeles egna teknikhjälp. Öppet dygnet runt. Nästan.", 1.2),
    ("g6", "Men låt oss vara rättvisa. När det gäller dammsugarpåsar, vet Dennis precis vad han gör.", 1.3),
    ("g7", "Och den här filmen? Ja, den har Adam haft ett finger med i. Men det stannar mellan oss.", 5.2),
    # --- VIII. Julius -------------------------------------------------------
    ("h1", "Varje stad har sina stamgäster.", 0.6),
    ("h2", "Och på {julius} café har Dennis varit en av de trognaste, i många år.", 0.8),
    ("h3", "Hit tar han med sig barnbarnen. På en kopp kaffe, något sött, och en stund tillsammans.", 0.9),
    ("h4", "Kanske är det där man lär känna honom bäst. Vid ett litet bord, med en kopp i handen.", 2.2),
    # --- Epilog -------------------------------------------------------------
    ("i1", "Ett långt arbetsliv har tagit slut. Men resten har bara fortsatt.", 0.9),
    ("i2", "Fiolen är stämd. Löparskorna står vid dörren. {napso} väntar på sin promenad.", 0.9),
    ("i3", "Och på {julius} finns det alltid en stol ledig.", 1.8),
    ("i4", "Det här var en film om Dennis Eriksson.", 1.0),
    ("i5", "Make. Pappa. Morfar och farfar.", 1.0),
    ("i6", "Och {alanning}. Rakt igenom.", 0.0),
]


# Ord som espeak betonar fel.
WORD_PRON = {
    "historia": "hɪstˈuːrɪa", "tillbaka": "tɪlbˈɑːka", "omkring": "ɔmkrˈɪŋ",
    "trettiotusen": "trˈɛtɪtˌʉːsən", "sextusen": "sˈɛkstˌʉːsən",
    "berättelsen": "bərˈɛtəlsən", "karriär": "karɪˈɛːr", "pensionär": "paŋɧʊnˈɛːr",
    "familjemedlem": "famˈɪljəmˌeːdlɛm", "promenad": "prʊmənˈɑːd", "promenader": "prʊmənˈɑːdər",
    "löpargruppen": "lˈøːparɡrˌɵpən", "egenskaper": "ˈeːɡənskˌɑːpər",
    "mobiltelefon": "mʊbˈiːltɛlɛfˌoːn", "gitarr": "jɪtˈar", "fiol": "fɪˈuːl",
    "fiolen": "fɪˈuːlən", "musiken": "mʉsˈiːkən", "musikens": "mʉsˈiːkəns",
    "tekniken": "tˈɛknɪkən", "teknikhjälp": "tɛknˈiːkjˌɛlp", "café": "kafˈeː", "caféet": "kafˈeːət",
    "rättvisa": "rˈɛtvˌiːsa", "dammsugarpåsar": "dˈamsʉːɡarpˌoːsar", "barnbarnen": "bˈɑːɳbɑːɳən",
    "barnbarnet": "bˈɑːɳbɑːɳət", "människor": "mˈɛnɪɧʊr", "människa": "mˈɛnɪɧa",
    "löparskorna": "lˈøːpaʂkˌuːɳa", "dennis": "dˈɛnɪs", "elin": "ˈeːlɪn", "stamgäster": "stˈamjɛstər",
}

# Visningstext för undertexter.
DISPLAY = [
    ("{canis} {lophus}", "Canis Løphus"), ("{canis} {lupus}", "canis lupus"),
    ("{mariehamn}", "Mariehamn"), ("{alanning}", "ålänning"), ("{psykiatrin}", "psykiatrin"),
    ("{kolen}", "Kölen"), ("{napso}", "Napso"), ("{julius}", "Julius"), ("{ukulele}", "ukulele"),
    ("sextusen", "6 000"), ("trettiotusen", "30 000"),
]


def display(text):
    out = text
    for a, b in DISPLAY:
        out = out.replace(a, b)
    return out


def spoken(text):
    """Text med fonem-ersättningar, redo för TTS."""
    import re
    out = text
    for key, ipa in PRON.items():
        out = out.replace("{" + key + "}", ipa)

    def sub(m):
        w = m.group(0)
        ipa = WORD_PRON.get(w.lower())
        return f"[[{ipa}]]" if ipa else w
    parts = re.split(r"(\[\[.*?\]\])", out)
    return "".join(p if p.startswith("[[") else re.sub(r"[A-Za-zÅÄÖåäöéè]+", sub, p) for p in parts)
