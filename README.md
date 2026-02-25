# TKK Cowork Plugins

Plugin marketplace van The Kind Kids — gedeelde skills en workflows voor Claude Cowork en Claude Code.

## Plugins

| Plugin | Beschrijving |
|--------|-------------|
| **[tkk-case-writer](./tkk-case-writer)** | Schrijf on-brand cases voor TKK, Statik en Shaved Monkey |

## Installeren

### In Cowork of Claude Code

Voeg eerst de marketplace toe:

```
/plugin marketplace add <repo-url>
```

Installeer dan een plugin:

```
/plugin install tkk-case-writer@tkk-plugins
```

### Lokaal testen

Test een plugin zonder te installeren:

```
claude --plugin-dir ./tkk-case-writer
```

## Nieuwe plugin toevoegen

1. Maak een map aan met de plugin-naam
2. Volg de [plugin-structuur](https://code.claude.com/docs/en/plugins-reference)
3. Voeg de plugin toe aan `.claude-plugin/marketplace.json`
4. Commit en push
