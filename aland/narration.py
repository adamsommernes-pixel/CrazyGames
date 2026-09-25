# -*- coding: utf-8 -*-
"""Manus: "Mellan två riken" – en kort film om Ålands historia.

Varje replik: (id, text, paus efter i sekunder).
Ord inom {klamrar} ersätts med handskrivna fonem (se PRON) för att
uttalet ska bli rätt – främst årtal och ortnamn.
"""

PRON = {
    "arton": "[[ˈɑːtɔnhˌɵndra]]",
    "femtiofyra": "[[fˈɛmtɪfˌyːra]]",
    "femtiosex": "[[fˈɛmtɪsˌɛks]]",
    "sextioett": "[[sˈɛkstɪˌɛt]]",
    "trettioatta": "[[trˈɛtɪˌɔta]]",
    "attioatta": "[[ˈɔtɪˌɔta]]",
    "mariehamn": "[[marˈiːəhˌamn]]",
    "geneve": "[[sxənˈɛːv]]",
    "viktoriakorset": "[[vɪktˈuːriːakˌɔʂət]]",
    "alanningar": "[[ˈoːlɛnɪŋar]]",
    "alanningarna": "[[ˈoːlɛnɪŋarna]]",
    "demilitariserat": "[[dˌeːmiːlˌiːtariːsˈeːrat]]",
    "ofreden": "[[ˈuːfrˌeːdən]]",
    "alandsexemplet": "[[ˈoːlandsɛksˌɛmplət]]",
}

LINES = [
    # --- Kall öppning -------------------------------------------------------
    ("o1", "Mitt i Östersjön, mellan Sverige och Finland, ligger ett land av sten och vatten.", 0.9),
    ("o2", "Mer än sextusen sjuhundra öar och skär.", 0.7),
    ("o3", "Omkring trettiotusen människor.", 0.9),
    ("o4", "Och en historia som har formats av stormakter, av krig. Och till slut, av fred.", 3.2),
    # --- I. Ur havet --------------------------------------------------------
    ("a1", "För mer än tiotusen år sedan låg allt detta begravt under is.", 0.8),
    ("a2", "När isen drog sig tillbaka började landet långsamt resa sig ur havet.", 0.5),
    ("a3", "Det gör det fortfarande. Några millimeter, varje år.", 1.0),
    ("a4", "De första människorna kom hit för omkring sjutusen år sedan. De kom i båtar, och de kom för sälen.", 0.8),
    ("a5", "Havet gav dem allt de behövde. Men havet tog också.", 2.0),
    # --- II. Kors och krona -------------------------------------------------
    ("b1", "Under vikingatiden låg öarna mitt i leden österut.", 0.6),
    ("b2", "I skogarna finns hundratals gravfält, bland enar och röd granit.", 0.9),
    ("b3", "Med kristendomen kom stenkyrkorna, några av de äldsta i Finland.", 0.9),
    ("b4", "Trettonhundra {attioatta} nämns Kastelholms slott för första gången. Härifrån styrdes öarna i den svenska kronans namn.", 2.0),
    # --- III. Postrodden ----------------------------------------------------
    ("c1", "Sextonhundra {trettioatta} öppnades postvägen mellan Stockholm och Åbo. Den gick rakt över Ålands hav.", 0.7),
    ("c2", "Det var bönderna som rodde posten. Vinter som sommar, genom storm och drivis.", 0.9),
    ("c3", "Många kom aldrig hem.", 2.4),
    # --- IV. Ofreden --------------------------------------------------------
    ("d1", "Sjuttonhundra fjorton kom kriget till öarna.", 0.5),
    ("d2", "Ryska trupper gick i land, och nästan hela befolkningen flydde till Sverige.", 0.7),
    ("d3", "Gårdar brändes. Öarna låg öde i sju år.", 0.6),
    ("d4", "Man kallar det Stora {ofreden}.", 1.4),
    ("d6", "{arton} nio förlorade Sverige Finland till Ryssland. Och Åland följde med.", 1.8),
    # --- V. Bomarsund -------------------------------------------------------
    ("e1", "Och ryssarna började bygga.", 0.7),
    ("e2", "Vid Bomarsund växte en fästning fram. Imperiets utpost i väster.", 0.8),
    ("e3", "Men den blev aldrig färdig.", 1.2),
    ("e4", "Sommaren {arton} {femtiofyra}, under Krimkriget, seglade en brittisk och fransk flotta in mellan skären.", 0.7),
    ("e5", "Här kastade en ung brittisk sjöofficer en brinnande granat överbord, och blev den förste att få {viktoriakorset}.", 0.9),
    ("e6", "I augusti dånade kanonerna i flera dagar.", 0.6),
    ("e7", "Den sextonde augusti gav fästningen upp. Sedan sprängdes den i luften.", 1.6),
    ("e8", "Vid freden i Paris, {arton} {femtiosex}, lovade Ryssland att aldrig mer befästa Åland.", 0.7),
    ("e9", "Det var ett första steg. Mot öar utan vapen.", 2.4),
    # --- VI. Segel ----------------------------------------------------------
    ("f1", "{arton} {sextioett} grundades {mariehamn}, uppkallad efter den ryska kejsarinnan Maria.", 0.8),
    ("f2", "Och {alanningarna} vände sig, som alltid, mot havet.", 0.9),
    ("f3", "När världen gick över till ånga, köpte redaren Gustaf Erikson de sista stora segelfartygen.", 0.6),
    ("f4", "Hans fyrmastade barkar fraktade vete från Australien, runt Kap Horn, ända in på fyrtiotalet.", 0.7),
    ("f5", "Världens sista stora segelflotta hade sin hemmahamn här.", 0.6),
    ("f6", "Ett av dem, Pommern, ligger kvar i {mariehamn} än i dag.", 2.0),
    # --- VII. Ålandsfrågan --------------------------------------------------
    ("g1", "Nittonhundra sjutton föll det ryska kejsardömet. Finland blev självständigt.", 0.7),
    ("g2", "Men på Åland ville man något annat. Nästan alla vuxna skrev under ett upprop. De ville återförenas med Sverige.", 0.9),
    ("g3", "Finland sa nej. Sverige sa ja. Och frågan hamnade hos det nybildade Nationernas förbund, i {geneve}.", 1.1),
    ("g4", "Den tjugofjärde juni, nittonhundra tjugoett, kom beslutet.", 0.8),
    ("g5", "Åland skulle tillhöra Finland.", 1.2),
    ("g6", "Men med villkor. Språket och kulturen skulle skyddas. Och öarna skulle få styra sig själva.", 0.9),
    ("g7", "Samma höst skrev tio stater under en konvention. Åland skulle vara {demilitariserat} och neutralt. Inga soldater. Inga fästningar. Inte ens i krig.", 0.9),
    ("g8", "Den nionde juni, nittonhundra tjugotvå, samlades Ålands landsting för första gången.", 2.0),
    # --- VIII. I dag --------------------------------------------------------
    ("h1", "I dag har Åland egen flagga, egna frimärken och ett eget parlament.", 0.6),
    ("h2", "Språket är svenska. Unga {alanningar} gör ingen värnplikt.", 0.6),
    ("h3", "I hamnarna ligger inga örlogsfartyg. Bara färjor, fiskebåtar och segel.", 1.4),
    ("h4", "En konflikt som kunde ha slutat i krig, löstes vid ett bord.", 0.7),
    ("h5", "Man kallar det för {alandsexemplet}.", 2.2),
    ("h6", "Ett litet land. Mitt i havet. Mellan två riken.", 1.0),
    ("h7", "Och en fred som fortfarande håller.", 0.0),
]


def spoken(text):
    """Text med fonem-ersättningar, redo för TTS."""
    out = text
    for key, ipa in PRON.items():
        out = out.replace("{" + key + "}", ipa)
    return out
