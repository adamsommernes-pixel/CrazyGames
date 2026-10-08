# -*- coding: utf-8 -*-
"""Everything Høyre must supply or approve lives here. Change a value and re-run
`make` – no other file needs touching."""

# Exact Høyre blue from the design manual. PLACEHOLDER until Høyre supplies [HEX].
HOYRE_BLUE = "#1f5fbf"

# End card. Empty string = show a visible placeholder in the draft.
URL = ""                 # [INSERT URL]
SOURCES_URL = ""         # [INSERT URL TIL KILDELISTE]
LOGO_PNG = ""            # path to Høyre's official logo (RGBA PNG), supplied by Høyre

# Draft marker in the top-left corner. Set False only after fact check and approval.
DRAFT = True
DRAFT_TEXT = "UTKAST · ikke faktasjekket · ikke godkjent"

# Picture. 1920x1080 master; set SCALE=2 for a 3840x2160 master (≈4× render time).
SCALE = 1
SUPERSAMPLE = 2          # anti-aliasing: render at 2× and downsample
