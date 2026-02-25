# TKK Cowork Plugins

Plugin marketplace van The Kind Kids — gedeelde skills en workflows voor Claude Cowork en Claude Code.

## Plugins

| Plugin | Beschrijving | Slash commands |
|--------|-------------|----------------|
| **[tkk-case-writer](./tkk-case-writer)** | Schrijf on-brand cases voor TKK, Statik en Shaved Monkey | `/tkk-case-writer:write-case` |
| **[tkk-tone](./tkk-tone)** | Tone of voice en communicatietemplates | — (skill, automatisch actief) |
| **[nmbs](./nmbs)** | Belgische treinverbindingen via iRail API | `/nmbs:train` |
| **[company-info](./company-info)** | Belgische bedrijfsinfo: KBO, jaarrekeningen, Staatsblad | `/company-info:company-lookup` |

## Installeren

### In Cowork of Claude Code

Voeg eerst de marketplace toe:

```
/plugin marketplace add statikbe/skill-market
```

Installeer dan een plugin:

```
/plugin install tkk-case-writer@tkk-plugins
/plugin install nmbs@tkk-plugins
/plugin install company-info@tkk-plugins
```

### Lokaal testen

Test een plugin zonder te installeren:

```
claude --plugin-dir ./nmbs
```

## Vereisten

Sommige plugins hebben runtime dependencies:

| Plugin | Vereisten |
|--------|-----------|
| **nmbs** | `bun` runtime |
| **company-info** | `bun` runtime, `python3` met `playwright` package, Chromium |

## Nieuwe plugin toevoegen

1. Maak een map aan met de plugin-naam
2. Volg de [plugin-structuur](https://code.claude.com/docs/en/plugins-reference)
3. Voeg de plugin toe aan `.claude-plugin/marketplace.json`
4. Commit en push
