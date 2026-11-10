# Voorgestelde technische architectuur

## Richting

Behoud de pure domeinmodules en vervang niet onnodig de bestaande configurator. Scheid daarna duidelijk:

1. domeinlogica;
2. applicatieservices/serverfuncties;
3. repositories en transacties;
4. UI en query-cache;
5. integratie- en documentadapters.

## Frontend

- TanStack Router voor routes en loaders.
- TanStack Query voor server-state en invalidatie.
- Bestaande `ChoiceGrid`, `Panel`, `PriceBreakdown`, `WindowDrawing` en configuratorstappen behouden.
- Een gedeelde `WorkflowStatus`, `ApprovalPanel`, `DocumentList` en `PriceSummary` toevoegen.
- Prijs- en validatiefeedback blijft live in de browser, maar serverresultaten blijven leidend.

## Backend

- Serverfuncties blijven de enige write-ingang voor configuratie, quotes, approvals, orders en integratiejobs.
- Zod-schema's per use case, niet één generieke payload voor alle tabellen.
- Autorisatie vóór repositorytoegang.
- Transacties voor quote finaliseren, orderconversie en job/outbox writes.

## Datamodel

Gebruik het bestaande relationele schema als basis in plaats van `records` als system of record. Behoud JSON alleen waar het domein dat vereist:

- configuration item snapshot;
- conditions/parameters van declaratieve regels;
- quote/revision snapshot;
- documentmetadata.

Introduceer minimaal:

- `organizations`, `organization_memberships`;
- typed `companies`, `contacts`, `projects`;
- catalogus- en prijsboekversies;
- `configuration_items` en immutable `quote_revisions`;
- `orders`, `order_events`, `audit_events`;
- `documents`, `attachments`;
- `integration_jobs`/outbox met idempotency key.

SQLite mag voor lokale demo en tests blijven, maar via dezelfde repositorycontracten als productie. Gebruik migraties, foreign keys, indexes en constraints.

## Regel- en prijsengine

Behoud `evaluateConfiguration`, `generateBom`, `computeItem` en `variantTotals` als pure functies. Voeg fixtures en property tests toe. Maak de prijsengine de enige bron van prijsberekening; UI mag nooit eigen totalen opslaan als waarheid.

Elke quote-revisie bewaart:

- configuratiesnapshot;
- BOM snapshot;
- prijsboek- en regelsversie;
- valutacode en btw;
- berekende lijnen en totalen;
- hash of vergelijkbare integriteitsreferentie.

## Documentgeneratie

Maak een `DocumentService` met adapters:

- quote PDF;
- technische fiche;
- BOM/productie-export;
- orderbevestiging.

Documenten worden alleen gegenereerd voor de gekozen revisie en krijgen een immutable metadatarecord. Templates, logo's, taal en downloadrechten horen in de service, niet in routecomponenten.

## 3D

Fase 1: parametrische Three.js/React Three Fiber viewer die dezelfde geometrische feiten als `WindowDrawing` gebruikt. Fase 2: doorsneden, selectie en maatvoering. Fase 3: gevalideerde glTF/CAD-pipeline. Geen STEP-upload of fotorealistische configurator in de MVP.

## Integraties

Gebruik connectorinterfaces met:

- `validate`;
- `buildPayload`;
- `send`;
- `pollStatus`;
- `retry`;
- `idempotencyKey`.

De Mock JoRPA-connector blijft testadapter. Er worden geen fictieve JoRPA-endpoints toegevoegd. Een outbox/integration-job maakt retries en fouten zichtbaar.

## Auth, autorisatie en tenancy

- Authenticated server middleware op alle datafuncties.
- Organization scope verplicht op ieder businessrecord.
- Role checks én recordscope checks.
- Geen clientgestuurde tabel- of kolomvrijheid.
- Uploads via gecontroleerde storageadapter.
- Audit events voor security- en commerciële mutaties.

## Teststrategie in architectuur

Pure engines krijgen unit/property tests. Repositories krijgen migratie- en transactietests. Serverfuncties krijgen autorisatie- en contracttests. Playwright test de volledige klant → orderflow.
