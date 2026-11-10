# Uitvoerbare development backlog

## P0

| ID | Taak | Hergebruik | Bestanden | Tests | Klaar wanneer |
|---|---|---|---|---|---|
| CPQ-001 | Serverauth op CRUD toevoegen | `requireSupabaseAuth`, `can` | `db.functions.ts`, auth middleware | auth contracttests | onbevoegde request krijgt 401/403 |
| CPQ-002 | Tabellen/kolommen per use case allowlisten | bestaande `DB_TABLES` | `db.functions.ts` | invalid payload tests | generieke payload kan geen verborgen data lezen |
| CPQ-003 | Relationele SQLite-schema's migreren | `db/schema.sql`, seeddata | `db/migrations`, repository | migration/ETL tests | data behoudt relaties en constraints |
| CPQ-004 | UUID/reference-strategie vastleggen | bestaande relationele schema | seed/import/repository | FK tests | alle serverfuncties accepteren runtime IDs |
| CPQ-005 | Quote revision lock afdwingen | bestaande snapshotfuncties | `cpq.functions.ts` | immutable tests | locked revisie is read-only |
| CPQ-006 | Approval UI aansluiten | `transitionQuote`, dashboard queries | quote route/components | transition E2E | verkoper/manager kunnen volledige flow uitvoeren |
| CPQ-007 | Quote PDF-service aansluiten | `src/lib/pdf` | document service, quote route | PDF assertions | PDF wordt opgeslagen en gedownload |
| CPQ-008 | Attachment storage adapter bouwen | bestaande Attachments UI | storage service/client | upload scope tests | upload/download werkt lokaal en server-side |

## P1

| ID | Taak | Hergebruik | Tests | Klaar wanneer |
|---|---|---|---|---|
| CPQ-009 | Productie-BOM seed en export | `bom.ts`, JoRPA payload | BOM fixtures | complete BOM voor demo-product |
| CPQ-010 | Prijsboek draft/publicatie | `catalog-loader.ts` | validity/version tests | alleen actieve versie wordt gebruikt |
| CPQ-011 | Ordermodel en quote-conversie | quote snapshots | state tests | accepted quote maakt één idempotente order |
| CPQ-012 | Audit events | bestaande mutation serverfunctions | audit tests | commerciële/security-acties zijn traceerbaar |
| CPQ-013 | Volledige configurator fixture-set | `rules.ts`, `pricing.ts` | rule/pricing tests | echte domeincombinaties zijn afgedekt |
| CPQ-014 | End-to-end smokeflow | alle bestaande routes | Playwright | klant tot order groen |

## P2

| ID | Taak | Hergebruik | Tests | Klaar wanneer |
|---|---|---|---|---|
| CPQ-015 | Organization en dealer scope | auth/roles | tenant isolation | tenantdata is strikt gescheiden |
| CPQ-016 | Guided selling wizard | `evaluateConfiguration`, `computeItem` | recommendation tests | aanbevelingen zijn technisch geldig |
| CPQ-017 | Parametrische 3D-MVP | `WindowDrawing`, `ItemConfig` | visual smoke | 2D/3D en maatvoering werken |
| CPQ-018 | Documenttemplates en branding | PDF service | template snapshots | talen/logo's werken |

## P3

| ID | Taak | Hergebruik | Tests | Klaar wanneer |
|---|---|---|---|---|
| CPQ-019 | AI-configuratievoorstellen | bestaande servervalidatie | adversarial validation | AI kan geen ongeldige write uitvoeren |
| CPQ-020 | RFQ-extractie | draft project/configuration | human-review tests | extractie maakt reviewbare voorstellen |
| CPQ-021 | Regelconflicten als advies | rule lint | conflict fixtures | beheerder krijgt begrijpelijke waarschuwing |
