---
name: train
description: Zoek een treinverbinding tussen twee Belgische stations
allowed-tools: Bash, Read
arguments:
  - name: van
    description: Vertrekstation (bv. Leuven, Gent-Sint-Pieters)
    required: true
  - name: naar
    description: Aankomststation (bv. Brussel-Centraal, Antwerpen-Centraal)
    required: true
  - name: tijd
    description: "Gewenste vertrektijd (HH:MM). Laat leeg voor nu."
    required: false
---

Zoek een treinverbinding van **$ARGUMENTS.van** naar **$ARGUMENTS.naar**.

Gebruik de **nmbs** skill. Voer het route-commando uit met de opgegeven stations.
Als een tijd is opgegeven, gebruik dan `--time $ARGUMENTS.tijd`.

Presenteer de resultaten overzichtelijk: vertrektijd, aankomsttijd, duur, overstappen, en spoor.
