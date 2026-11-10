# Huidige architectuur

## Samenvatting

De applicatie is een TanStack Start/React CPQ-prototype voor ramen en deuren. De browser gebruikt een Supabase-achtige clientinterface, maar de lokale demo routeert databasebewerkingen naar SQLite. De sterkste onderdelen zijn de declaratieve regelengine, cents-gebaseerde prijsengine, BOM-berekening en server-side herberekening bij configuratie-opslag.

De applicatie is nog geen productieklare CPQ-backend. De lokale opslag gebruikt één generieke JSON-recordtabel, de CRUD-serverfunctie heeft geen autorisatiemiddleware, en meerdere backendmogelijkheden zijn niet vanuit de UI aangesloten.

## Hoofdcomponenten

| Laag | Implementatie | Belangrijkste bestanden |
|---|---|---|
| Frontend | React, TanStack Router/Query, Tailwind/UI-componenten | `src/routes`, `src/components` |
| Lokale database | SQLite via `better-sqlite3` | `src/lib/sqlite-db.server.ts`, `db/schema.sql` |
| Database-adapter | Supabase-achtige `.from().select/insert/update/delete/upsert` | `src/integrations/supabase/client.ts` |
| Serverfuncties | TanStack server functions met Zod-validatie | `src/lib/cpq.functions.ts`, `src/lib/db.functions.ts` |
| Configuratie | Declaratieve opties, regels, validatie en auto-includes | `src/lib/cpq/rules.ts` |
| Prijs | Prijsboeken, matrixprijzen, opties, BOM, arbeid, diensten en volumekorting | `src/lib/cpq/pricing.ts` |
| Productie | BOM-generator en technische fiche | `src/lib/cpq/bom.ts`, `src/routes/_authenticated/fiche.$itemId.tsx` |
| Integratie | Mock JoRPA-connector met retry/idempotencygedrag | `src/lib/connectors/jorpa.ts`, `src/lib/cpq.functions.ts` |
| Auth | Lokale demo-sessies en vier rollen | `src/lib/local-db.ts`, `src/lib/auth.ts` |

## Datastromen

### Configuratie en prijs

1. De configurator laadt project, configuratie-item en catalogus.
2. `evaluateConfiguration()` normaliseert de configuratie, past auto-includes toe, berekent beschikbaarheid en produceert technische issues.
3. `generateBom()` maakt een BOM op basis van actieve templates en regels.
4. `priceItem()` berekent bedragen in eurocenten.
5. De browser toont de live berekening.
6. `saveConfigurationItem` voert dezelfde validatie en prijsberekening opnieuw uit op de server voordat wordt opgeslagen.

### Lokale CRUD

1. UI gebruikt de lokale `supabase`-adapter.
2. De adapter roept `dbRequest` aan.
3. `dbRequest` bouwt een `SqliteQuery`.
4. `SqliteQuery` leest en schrijft `records(table_name, id, data_json, ...)`.
5. Relaties worden handmatig opnieuw opgebouwd in `relations()`.

### Offerte

De serverfuncties bouwen snapshots, revisies, quote lines, kortingstoetsing en approvals. De offertepagina toont echter maar een deel van deze flow; goedkeuren, verzenden, PDF-generatie en acceptatie zijn niet volledig via de UI bereikbaar.

## Bevestigd aanwezig en werkend

- Productfamilies, systemen, opties en configuratiestappen.
- Dynamische technische validatie en verklaringen voor onbeschikbare opties.
- Matrix-, basis-, optie-, component-, dienst- en arbeidsprijzen.
- Prijsboekfactoren en volumekorting.
- Cents-gebaseerde totalen en interne marge wanneer kosten zichtbaar zijn.
- Configuratievarianten, dupliceren en groepswijzigingen.
- Server-side configuratievalidatie en optimistic version check.
- BOM-generator en mock JoRPA-payload.
- Vier lokale demo-rollen.

## Aanwezig maar onvolledig of niet aangesloten

- Offertegoedkeuringen bestaan server-side, maar de UI roept de transities niet volledig aan.
- PDF-helpers en `jspdf` bestaan, maar offerte-PDF's worden niet gegenereerd en opgeslagen.
- Attachments-UI gebruikt Supabase Storage, terwijl de lokale client geen `storage` exposeert.
- Drizzle/Postgres-migratie bevat een relationeel schema, maar lokale runtime gebruikt de generieke SQLite-laag.
- Productie- en beheerpagina's tonen data, maar versie/publicatie/rollback is niet volledig uitgewerkt.
- JoRPA is uitsluitend een mock; er is geen echt contract en geen netwerkconnector.

## Niet aanwezig of niet verifieerbaar

- Productieklare multi-tenant isolatie.
- Dealerportaal en klantportaal met organisatiegrenzen.
- Klantacceptatie en orderconversie als complete workflow.
- Onveranderlijke documentversies met toegangscontrole.
- Auditlogboek.
- Volledige 2D/3D-parametrische visualisatie.
- Guided selling en AI-ondersteuning.
- Uitgebreide end-to-end testdekking.

## Architecturale risico's

1. Eén JSON-recordtabel biedt geen foreign keys, typed constraints of relationele indexen.
2. `dbRequest` heeft geen server-side auth middleware en exposeert alle toegestane tabellen.
3. Lokale seed-ID's zijn niet altijd UUID's, terwijl servervalidatie UUID's verwacht.
4. Relaties worden in TypeScript opgebouwd en kunnen inconsistent raken.
5. Snapshot-onveranderlijkheid is niet overal door databaseconstraints afgedwongen.
6. Bestandsopslag en documenthistoriek zijn niet uniform lokaal geïmplementeerd.
7. Testdekking bestaat momenteel uit één routingtest en één assertion en valideert de kernflows niet.

## Aanbeveling

Behoud de pure CPQ-engine, adapterinterface en declaratieve regels. Bouw eerst een beveiligde relationele SQLite-runtime met migraties, typed repositories en geïntegreerde workflowtests. Gebruik het bestaande relationele schema als uitgangspunt voor de mapping in plaats van de JSON-recordtabel verder uit te breiden.
