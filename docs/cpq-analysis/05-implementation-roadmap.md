# Implementatieroadmap

Schattingen zijn voor één ontwikkelaar met AI-ondersteuning en veronderstellen beschikbare productregels, prijsdata en documenttemplates. Onzekerheid is hoog zolang bedrijfsregels en JoRPA-contract ontbreken.

## P0 — betrouwbaarheid en beveiliging (2–4 weken)

| Taak | Stappen | Bestanden/onderdelen | Acceptatie |
|---|---|---|---|
| CRUD beveiligen | auth middleware, allowlists, recordscope, servervalidatie | `db.functions.ts`, `sqlite-db.server.ts`, `auth-middleware.ts` | ongeautoriseerde CRUD wordt geweigerd |
| Relationele SQLite-migratie | schema, migrations, ETL van records, UUID mapping | `db/`, repositorylaag | seed en bestaande demo-flow werken met constraints |
| Quote snapshots locken | immutable revision writes, version checks, audit | `cpq.functions.ts`, quote-tabellen | locked revisie verandert niet |
| Documentflow aansluiten | PDF service, opslagadapter, documentlijst | `src/lib/pdf`, quote route | quote-PDF downloadbaar met bronversie |
| Kernregressies | unit/integratie tests voor auth, pricing, persistence | `src/**/*.test.*` | volledige P0-suite groen |

## P1 — complete CPQ (4–8 weken)

- Quote UI voor indienen, goedkeuren, afwijzen, verzenden en accepteren.
- Offerte naar order met statushistoriek.
- Volledige BOM-data en productie-export.
- Versiebeheer voor prijsboeken, regels en productcatalogus.
- Attachments veilig maken.
- Approval policy en margeweergave.
- E2E-flow van klant tot order.

## P2 — geavanceerde configuratie en portalen (6–12 weken)

- Organization/tenantmodel en dealerportal.
- Klant self-service.
- Public/embed configurator met beperkte scope.
- Guided selling op bestaande regelengine.
- 2D/3D-MVP met maatvoering en selectie.
- Documenttemplates, branding en meertaligheid.

## P3 — AI en aanvullende innovatie (3–6 weken voor eerste pilots)

- AI-assistent voor zoekvragen en configuratievoorstellen.
- Regelconflictdetectie als adviesfunctie.
- RFQ-extractie naar reviewbare conceptconfiguratie.
- Lokale/private modeloptie.

## Aanbevolen volgorde

Begin niet met 3D of AI. Eerst moeten autorisatie, snapshots, documentflow en de end-to-end commerciële workflow betrouwbaar zijn. Daarna levert een 2D/3D-MVP de grootste zichtbare productwaarde met beperkt technisch risico.
