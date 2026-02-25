---
name: company-lookup
description: Zoek informatie op over een Belgisch bedrijf (KBO, jaarrekeningen, publicaties)
allowed-tools: Bash, Read
arguments:
  - name: bedrijf
    description: Bedrijfsnaam of KBO-nummer (bv. "Statik" of "0454.064.819")
    required: true
  - name: diepte
    description: "Hoe diep wil je gaan?"
    required: false
    type: enum
    options:
      - Snel overzicht (KBO + basisinfo)
      - Volledige analyse (KBO + financiën + publicaties)
---

Zoek informatie op over **$ARGUMENTS.bedrijf**.

Gebruik de **company-info** skill en volg de workflow:

1. Als het een naam is (geen nummer): zoek eerst via `search`
2. Haal KBO-data op (directors, NACE codes, capaciteiten)
3. Bij "Volledige analyse": haal ook de laatste twee jaarrekeningen op via `csv` en zoek relevante publicaties

Presenteer de resultaten gestructureerd en in het Nederlands.
