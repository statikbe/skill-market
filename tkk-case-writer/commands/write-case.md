---
name: write-case
description: Schrijf een nieuwe case voor The Kind Kids, Statik of Shaved Monkey
allowed-tools: Read, Write, Edit
user-intent: |
  Schrijf een case study op basis van het materiaal dat ik aanreik.
  Volg de TKK Case Writer skill voor structuur, tone of voice en kwaliteitschecklist.
arguments:
  - name: klant
    description: Naam van de klant
    required: true
  - name: merk
    description: "Welk merk? (The Kind Kids / Statik / Shaved Monkey)"
    required: true
    type: enum
    options:
      - The Kind Kids
      - Statik
      - Shaved Monkey
  - name: context
    description: "Beschrijf het project: deliverables, uitdaging, resultaten, quotes, cijfers — alles wat je hebt"
    required: true
    type: text
---

Schrijf een case voor **$ARGUMENTS.klant** onder het merk **$ARGUMENTS.merk**.

Gebruik de **case-writer** skill als leidraad — volg de structuur, tone of voice, schrijfstijl en kwaliteitschecklist exact.

## Projectcontext

$ARGUMENTS.context

## Instructies

1. Analyseer de input: identificeer de kern van het verhaal, de fases, bruikbare quotes en harde resultaten.
2. Schrijf de case volgens de casestructuur uit de skill.
3. Genereer SEO-elementen (meta description, URL-slug, alt-teksten).
4. Loop de kwaliteitschecklist na en corrigeer waar nodig.
5. Lever de case op in Markdown.
