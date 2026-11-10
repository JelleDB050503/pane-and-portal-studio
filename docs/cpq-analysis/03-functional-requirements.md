# Functionele requirements

## P0 — betrouwbaarheid en veiligheid

### FR-001 Beveiligde lokale CRUD
- **Rol:** alle gebruikers.
- **Gedrag:** elke CRUD-aanvraag valideert sessie, rol, tabel, recordscope en toegestane velden server-side.
- **Businessregels:** alleen toegestane rollen mogen schrijven; productie mag commerciële prijzen niet wijzigen.
- **Acceptatie:** een gebruiker kan geen andere tabel of record lezen/schrijven door de requestpayload te manipuleren.
- **Afhankelijkheden:** auth middleware, relationeel repository.

### FR-002 Prijs- en configuratiesnapshot
- **Rol:** verkoper, manager.
- **Gedrag:** een quote-revisie bewaart configuratie, regelsversie, prijsboekversie, lijnen en totalen.
- **Businessregels:** latere cataloguswijzigingen wijzigen geen gelockte revisie.
- **Acceptatie:** herladen van een goedgekeurde revisie toont exact dezelfde bedragen en configuratie.

### FR-003 Offerteworkflow
- **Rol:** verkoper, manager, klant.
- **Gedrag:** concept, indienen, goedkeuren, afwijzen, verzenden, accepteren en vervallen.
- **Acceptatie:** ongeldige transities worden geweigerd met een duidelijke reden en worden gelogd.

### FR-004 Documentpersisting
- **Rol:** verkoper, manager, productie.
- **Gedrag:** quote-PDF, technische fiche en BOM-document worden gegenereerd vanuit een gelockte snapshot en als versie opgeslagen.
- **Acceptatie:** elk document heeft bronrevisie, maker, timestamp en downloadrecht.

## P1 — complete CPQ

### FR-005 Volledige productie-BOM
- **Rol:** productie.
- **Gedrag:** geldige configuraties produceren multi-level BOM, glas-, profiel-, beslag- en bewerkingsgegevens.
- **Acceptatie:** ontbrekende componentprijs of technische regel blokkeert productie-export.

### FR-006 Prijsboekversies
- **Rol:** productbeheerder.
- **Gedrag:** conceptprijsboek, validatie, publicatie, geldigheid en rollback.
- **Acceptatie:** een bestaand project blijft aan de gekozen prijsboekversie gekoppeld.

### FR-007 Offerte naar bestelling
- **Rol:** manager/productie.
- **Gedrag:** alleen geaccepteerde revisies kunnen worden omgezet naar een order.
- **Acceptatie:** order bevat onveranderlijke referentie naar quote-revisie en orderstatushistoriek.

### FR-008 Attachments
- **Rol:** verkoper/productie.
- **Gedrag:** veilige upload, MIME/size-validatie, scopes en historiek.
- **Acceptatie:** gebruiker kan geen bestand van een ander project downloaden.

### FR-009 Regelbeheer
- **Rol:** productbeheerder.
- **Gedrag:** regels aanmaken, testen, linten, publiceren en terugrollen.
- **Acceptatie:** conflicterende regels worden vóór publicatie gemeld.

## P2 — portalen en geavanceerde configuratie

### FR-010 Multi-tenant dealerportal
- **Rol:** dealerbeheerder/dealer.
- **Gedrag:** organisatiegebonden klanten, projecten, catalogi en prijsboeken.
- **Acceptatie:** tenant A kan geen enkele identifier van tenant B lezen of muteren.

### FR-011 Guided selling
- **Rol:** verkoper/eindklant.
- **Gedrag:** wizard vertaalt behoeften naar technisch geldige aanbevelingen.
- **Businessregels:** iedere aanbeveling gaat door dezelfde rules- en pricing-engine.
- **Acceptatie:** opties tonen beschikbaarheid en reden van uitsluiting.

### FR-012 3D-MVP
- **Rol:** alle configuratorgebruikers.
- **Gedrag:** 2D/3D-wissel, zoom, rotatie, selectie en maatvoering.
- **Acceptatie:** wijzigingen in `ItemConfig` worden live in beide views verwerkt.

## P3 — innovatie

### FR-013 AI-assistent
- **Rol:** productbeheerder/verkoper.
- **Gedrag:** AI stelt configuraties, regels of antwoorden voor.
- **Businessregels:** AI schrijft nooit rechtstreeks regels, prijzen of orders.
- **Acceptatie:** ieder voorstel is zichtbaar als voorstel en wordt opnieuw gevalideerd.
