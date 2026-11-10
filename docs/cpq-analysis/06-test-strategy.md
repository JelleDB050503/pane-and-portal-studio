# Teststrategie

## Huidige uitgangssituatie

De huidige testopdracht slaagt, maar de dekking is onvoldoende: er is slechts één routingtest/assertion en geen betrouwbare dekking van prijs, regels, persistence, auth, documenten of integraties.

## Testlagen

### 1. Pure domeintests

- `normalizeConfig` vult defaults correct aan.
- Rule conditions evalueren alle operators.
- Niet-beschikbare opties krijgen reden.
- Auto-includes convergeren en veroorzaken geen ongecontroleerde lus.
- Dimension limits, sections en hinge-validatie.
- Matrixprijs kiest de kleinste passende cel.
- Optieprijzen respecteren systeem en prijsboek.
- Staffelkorting, btw, marge en afronding.
- BOM quantity bases.

### 2. Repository- en migratietests

- Fresh database voert alle migraties uit.
- Seed is idempotent.
- Foreign keys en unieke constraints werken.
- CRUD is transactioneel.
- Update/delete respecteert recordscope.
- Snapshotrecords zijn niet muteerbaar na lock.

### 3. Serverfunctie- en autorisatietests

- Iedere rol kan alleen toegestane acties uitvoeren.
- `dbRequest` accepteert geen onbekende tabel/kolom/operatie.
- Server herberekent configuratie en prijs.
- Stale `expectedVersion` wordt geweigerd.
- Approval transitions volgen de state machine.
- Orderconversie kan alleen vanuit accepted quote.

### 4. Documenttests

- PDF bevat klant, project, revisie, lijnen, totalen en datum.
- PDF gebruikt snapshotdata, niet actuele catalogusdata.
- Technische fiche bevat configuratie, validatie en BOM.
- Documentversie en downloadscope worden opgeslagen.

### 5. Integratietests

- Mock JoRPA success.
- Timeout en server error.
- Retry met bounded attempts.
- Idempotency voorkomt dubbele orders/jobs.
- Foutstatus is zichtbaar in de UI.

### 6. End-to-end

Test minimaal:

1. demo-login per rol;
2. klant aanmaken;
3. project aanmaken;
4. item configureren;
5. technische validatie oplossen;
6. live prijs en marge;
7. offerte/revisie maken;
8. approval;
9. PDF downloaden;
10. klantacceptatie;
11. order creëren;
12. BOM/JoRPA export.

## Kwaliteitscriteria

- Geen productieflow zonder server-side validatie.
- Geen mutable approved snapshot.
- Geen cross-tenant record in positieve of negatieve tests.
- Prijsfixtures bevatten randwaarden en ontbrekende prijzen.
- CI voert lint, typecheck, unit, integration en E2E smoke uit.
