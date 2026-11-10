# Hive CPQ gap-analyse

Bronnen: [Hive CPQ](https://hivecpq.com/en-us), [configurator](https://hivecpq.com/en-us/configurator), [3D-visualisatie](https://hivecpq.com/en/configurator/3d-visualization), [documentgeneratie](https://hivecpq.com/en/configurator/document-generation). Hive-functionaliteit hieronder is alleen opgenomen wanneer publiek beschreven; implementatiedetails, SLA's en API-contracten zijn niet publiek geverifieerd.

| Functionaliteit | Hive CPQ | Eigen applicatie | Status | Prioriteit | Benodigde wijziging |
|---|---|---|---|---|---|
| Rule-based configurator | Publiek beschreven configurator met technische beperkingen | `rules.ts` evalueert regels, issues en auto-includes | Aanwezig, demo-scope | P1 | Meer echte productregels en fixtures |
| Productfamilies/systemen | Ondersteund door low-code configuratie | Families, systemen en templates bestaan | Aanwezig | P1 | Beheerworkflow en versiebeheer |
| Ramen/deuren, vakken en draairichting | Domeinspecifiek vereist | Sections, opening en hinge bestaan | Aanwezig | P1 | Volledige technische regels en testmatrix |
| Prijsboeken en kortingen | Automatische prijzen, markups en discounts | Prijsengine ondersteunt prijsboekfactor, staffel en prijsregels | Aanwezig, demo-scope | P1 | Prijsversies, snapshots en autorisatie |
| Multi-level BOM | Hive claimt BOM bij finaliseren quote | BOM-code bestaat, lokale seed-BOM is leeg | Gedeeltelijk | P1 | BOM-seed, productie-export en snapshot |
| 2D-visualisatie | Hive beschrijft 2D/3D-wissel en metingen | SVG/window drawing bestaat | Aanwezig, 2D | P2 | Maatvoering, export en componentselectie |
| 3D-visualisatie | Interactieve 3D, cross-sections, animaties en foto-omgeving | Niet aanwezig | Ontbreekt | P2 | MVP met parametrische R3F-viewer |
| Documenten | Quotes, technische fiches, calculation sheets, manuals, branding en talen | PDF-helper en technische fiche bestaan; quote-PDF niet aangesloten | Gedeeltelijk | P0/P1 | Documentservice, opslag, templates en versiebeheer |
| Quote-to-order | Hive claimt approved quote naar order en tracking | Ordermodel en volledige UI-flow ontbreken | Ontbreekt | P1 | Ordertabellen, transities en auditlog |
| Dealer/self-service | Hive beschrijft dealers en embedded configurator | Geen tenant/dealerisolatie | Ontbreekt | P2 | Organization model, scopes, portal en publieke API |
| Guided selling | Niet voldoende technisch publiek gespecificeerd | Niet aanwezig | Ontbreekt | P2 | Wizard die bestaande rules engine gebruikt |
| AI | Niet als technische implementatie verifieerbaar | Niet aanwezig | Buiten MVP | P3 | Alleen voorstellen; altijd servervalidatie |
| ERP/CRM/PIM/PLM | Hive claimt pull/push-integraties | Alleen JoRPA mock | Gedeeltelijk | P1/P2 | Connectorcontract, outbox, retries, idempotency |
| Approvals | Publieke workflowdetails onbekend | Servertransities bestaan, UI niet compleet | Gedeeltelijk | P0/P1 | Approval UI, policyweergave en audit |
| Concurrente revisies | Hive claimt samenwerking, exacte semantiek onbekend | Version check bij configuratie-item | Gedeeltelijk | P1 | Revision locks en conflict UI |

## Technische haalbaarheid 3D-MVP

Een haalbare eerste stap is een parametrische 3D-weergave van kader, vleugels, glasvlakken en vakken op basis van dezelfde `ItemConfig` die de bestaande SVG gebruikt. React Three Fiber/Three.js kan dit toevoegen zonder CAD-import in de eerste fase. CAD/STEP-import en fotorealistische rendering blijven een latere fase door modelconversie, performance en onderhoud.

## Belangrijke afwijking

Hive-pagina's zijn marketing- en productdocumentatie. Ze bewijzen niet welke interne datamodellen, API's, prijsformules, securitymaatregelen of performance-eigenschappen Hive gebruikt. Die onderdelen mogen dus niet als implementatie-eis worden ingevuld met verzonnen details.
