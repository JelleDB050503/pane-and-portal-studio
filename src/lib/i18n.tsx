import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Lightweight i18n structure: Dutch (Flemish terminology) is the default and the only
// fully translated language. FR/EN keys exist for navigation and shared labels; missing
// keys fall back to Dutch. Catalogue items carry their own name_nl/name_fr/name_en.

export type Locale = "nl" | "fr" | "en";
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "nl", label: "NL" },
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
];

const nl = {
  "nav.dashboard": "Dashboard",
  "nav.customers": "Klanten",
  "nav.projects": "Projecten",
  "nav.guidedSelling": "Verkoopassistent",
  "nav.production": "Productie",
  "nav.admin": "Beheer",
  "nav.signout": "Afmelden",
  "page.dashboard.title": "Dashboard",
  "page.customers.title": "Klanten",
  "page.customers.subtitle": "klanten · particulieren, aannemers, dealers en architecten",
  "page.customers.new": "Nieuwe klant",
  "page.projects.title": "Projecten",
  "page.projects.subtitle": "projecten",
  "page.projects.new": "Nieuw project",
  "page.production.title": "Productie",
  "page.admin.title": "Beheer",
  "page.quotes.title": "Offerte",
  "common.all": "Alle",
  "common.types": "types",
  "common.statuses": "statussen",
  "dashboard.eyebrow": "Overzicht",
  "dashboard.greeting": "Goedemorgen",
  "dashboard.subtitle": "Stand van offertes en projecten (fictieve gegevens).",
  "dashboard.openQuotes": "Openstaande offertes",
  "dashboard.exclVat": "excl. btw",
  "dashboard.drafts": "Concepten",
  "dashboard.notSubmitted": "nog niet ingediend",
  "dashboard.pendingApproval": "Wachtend op goedkeuring",
  "dashboard.yourReview": "jouw beoordeling nodig",
  "dashboard.manager": "bij manager",
  "dashboard.winRate": "Scoringsgraad",
  "dashboard.acceptedOf": "aanvaard van",
  "dashboard.decided": "beslist",
  "dashboard.quotes": "Offertes",
  "dashboard.projectCustomer": "Project / klant",
  "dashboard.status": "Status",
  "dashboard.net": "Netto",
  "dashboard.noQuotes": "Nog geen offertes. Open een project en klik op \"Offerte maken\".",
  "dashboard.approvalRequired": "goedkeuring vereist",
  "dashboard.waitingApproval": "Wachtend op goedkeuring",
  "dashboard.review": "Beoordelen",
  "dashboard.view": "Bekijken",
  "dashboard.recentProjects": "Recent gewijzigde projecten",
  "dashboard.allProjects": "Alle projecten",
  "dashboard.delivery": "levering",
  "status.quote.concept": "Concept",
  "status.quote.interne_controle": "Interne controle",
  "status.quote.goedgekeurd": "Goedgekeurd",
  "status.quote.verzonden": "Verzonden",
  "status.quote.aanvaard": "Aanvaard",
  "status.quote.afgewezen": "Afgewezen",
  "status.quote.vervallen": "Vervallen",
  "status.project.lead": "Lead",
  "status.project.in_opmaak": "In opmaak",
  "status.project.offerte": "Offerte",
  "status.project.gewonnen": "Gewonnen",
  "status.project.verloren": "Verloren",
  "status.project.in_productie": "In productie",
  "company.particulier": "Particulier",
  "company.aannemer": "Aannemer",
  "company.dealer": "Dealer",
  "company.architect": "Architect",
  "demo.banner": "Demo – niet gebruiken voor verkoop. Alle prijzen, maten, U-waarden en BOM-regels zijn fictieve testgegevens.",
  "common.save": "Opslaan",
  "common.cancel": "Annuleren",
  "common.search": "Zoeken",
  "common.new": "Nieuw",
  "common.delete": "Verwijderen",
  "common.edit": "Bewerken",
  "common.loading": "Laden…",
  "role.verkoper": "Verkoper",
  "role.productbeheerder": "Productbeheerder",
  "role.manager": "Manager",
  "role.productie": "Productie / lezer",
} as const;

export type MessageKey = keyof typeof nl;

const fr: Partial<Record<MessageKey, string>> = {
  "nav.dashboard": "Tableau de bord",
  "nav.customers": "Clients",
  "nav.projects": "Projets",
  "nav.guidedSelling": "Vente guidée",
  "nav.production": "Production",
  "nav.admin": "Gestion",
  "nav.signout": "Déconnexion",
  "page.dashboard.title": "Tableau de bord",
  "page.customers.title": "Clients",
  "page.customers.subtitle": "clients · particuliers, entrepreneurs, revendeurs et architectes",
  "page.customers.new": "Nouveau client",
  "page.projects.title": "Projets",
  "page.projects.subtitle": "projets",
  "page.projects.new": "Nouveau projet",
  "page.production.title": "Production",
  "page.admin.title": "Gestion",
  "page.quotes.title": "Devis",
  "common.all": "Tous",
  "common.types": "types",
  "common.statuses": "statuts",
  "dashboard.eyebrow": "Aperçu",
  "dashboard.greeting": "Bonjour",
  "dashboard.subtitle": "État des devis et des projets (données fictives).",
  "dashboard.openQuotes": "Devis ouverts",
  "dashboard.exclVat": "hors TVA",
  "dashboard.drafts": "Brouillons",
  "dashboard.notSubmitted": "pas encore soumis",
  "dashboard.pendingApproval": "En attente d'approbation",
  "dashboard.yourReview": "votre évaluation est requise",
  "dashboard.manager": "auprès du manager",
  "dashboard.winRate": "Taux de réussite",
  "dashboard.acceptedOf": "acceptés sur",
  "dashboard.decided": "décidés",
  "dashboard.quotes": "Devis",
  "dashboard.projectCustomer": "Projet / client",
  "dashboard.status": "Statut",
  "dashboard.net": "Net",
  "dashboard.noQuotes": "Aucun devis. Ouvrez un projet et cliquez sur « Créer un devis ».",
  "dashboard.approvalRequired": "approbation requise",
  "dashboard.waitingApproval": "En attente d'approbation",
  "dashboard.review": "Évaluer",
  "dashboard.view": "Voir",
  "dashboard.recentProjects": "Projets récemment modifiés",
  "dashboard.allProjects": "Tous les projets",
  "dashboard.delivery": "livraison",
  "status.quote.concept": "Brouillon",
  "status.quote.interne_controle": "Contrôle interne",
  "status.quote.goedgekeurd": "Approuvé",
  "status.quote.verzonden": "Envoyé",
  "status.quote.aanvaard": "Accepté",
  "status.quote.afgewezen": "Refusé",
  "status.quote.vervallen": "Expiré",
  "status.project.lead": "Prospect",
  "status.project.in_opmaak": "En préparation",
  "status.project.offerte": "Devis",
  "status.project.gewonnen": "Gagné",
  "status.project.verloren": "Perdu",
  "status.project.in_productie": "En production",
  "company.particulier": "Particulier",
  "company.aannemer": "Entrepreneur",
  "company.dealer": "Revendeur",
  "company.architect": "Architecte",
  "demo.banner": "Démo – ne pas utiliser pour la vente. Tous les prix, dimensions et nomenclatures sont fictifs.",
  "role.verkoper": "Vendeur",
  "role.productbeheerder": "Gestionnaire produit",
  "role.manager": "Manager",
  "role.productie": "Production / lecteur",
};

const en: Partial<Record<MessageKey, string>> = {
  "nav.dashboard": "Dashboard",
  "nav.customers": "Customers",
  "nav.projects": "Projects",
  "nav.guidedSelling": "Guided selling",
  "nav.production": "Production",
  "nav.admin": "Admin",
  "nav.signout": "Sign out",
  "page.dashboard.title": "Dashboard",
  "page.customers.title": "Customers",
  "page.customers.subtitle": "customers · private clients, contractors, dealers and architects",
  "page.customers.new": "New customer",
  "page.projects.title": "Projects",
  "page.projects.subtitle": "projects",
  "page.projects.new": "New project",
  "page.production.title": "Production",
  "page.admin.title": "Admin",
  "page.quotes.title": "Quote",
  "common.all": "All",
  "common.types": "types",
  "common.statuses": "statuses",
  "dashboard.eyebrow": "Overview",
  "dashboard.greeting": "Good morning",
  "dashboard.subtitle": "Quote and project overview (fictional data).",
  "dashboard.openQuotes": "Open quotes",
  "dashboard.exclVat": "excl. VAT",
  "dashboard.drafts": "Drafts",
  "dashboard.notSubmitted": "not submitted yet",
  "dashboard.pendingApproval": "Awaiting approval",
  "dashboard.yourReview": "your review is required",
  "dashboard.manager": "with manager",
  "dashboard.winRate": "Win rate",
  "dashboard.acceptedOf": "accepted of",
  "dashboard.decided": "decided",
  "dashboard.quotes": "Quotes",
  "dashboard.projectCustomer": "Project / customer",
  "dashboard.status": "Status",
  "dashboard.net": "Net",
  "dashboard.noQuotes": "No quotes yet. Open a project and click “Create quote”.",
  "dashboard.approvalRequired": "approval required",
  "dashboard.waitingApproval": "Awaiting approval",
  "dashboard.review": "Review",
  "dashboard.view": "View",
  "dashboard.recentProjects": "Recently changed projects",
  "dashboard.allProjects": "All projects",
  "dashboard.delivery": "delivery",
  "status.quote.concept": "Draft",
  "status.quote.interne_controle": "Internal review",
  "status.quote.goedgekeurd": "Approved",
  "status.quote.verzonden": "Sent",
  "status.quote.aanvaard": "Accepted",
  "status.quote.afgewezen": "Rejected",
  "status.quote.vervallen": "Expired",
  "status.project.lead": "Lead",
  "status.project.in_opmaak": "In preparation",
  "status.project.offerte": "Quote",
  "status.project.gewonnen": "Won",
  "status.project.verloren": "Lost",
  "status.project.in_productie": "In production",
  "company.particulier": "Private client",
  "company.aannemer": "Contractor",
  "company.dealer": "Dealer",
  "company.architect": "Architect",
  "demo.banner": "Demo – not for sales use. All prices, dimensions and BOM rules are fictitious test data.",
  "role.verkoper": "Sales",
  "role.productbeheerder": "Product manager",
  "role.manager": "Manager",
  "role.productie": "Production / viewer",
};

const DICTS: Record<Locale, Partial<Record<MessageKey, string>>> = { nl, fr, en };

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<Ctx>({ locale: "nl", setLocale: () => {}, t: (k) => nl[k] });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("nl");
  useEffect(() => {
    const stored = window.localStorage.getItem("cpq-locale");
    if (stored === "fr" || stored === "en") setLocaleState(stored);
  }, []);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem("cpq-locale", l);
    document.documentElement.lang = l;
  }, []);
  const t = useCallback((key: MessageKey) => DICTS[locale][key] ?? nl[key], [locale]);
  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}

/** Pick the catalogue label for the current locale, falling back to Dutch. */
export function localName(item: { name_nl: string; name_fr?: string | null; name_en?: string | null }, locale: Locale): string {
  if (locale === "fr" && item.name_fr) return item.name_fr;
  if (locale === "en" && item.name_en) return item.name_en;
  return item.name_nl;
}
