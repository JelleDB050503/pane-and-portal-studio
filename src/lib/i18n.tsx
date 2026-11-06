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
  "nav.production": "Productie",
  "nav.admin": "Beheer",
  "nav.signout": "Afmelden",
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
  "nav.production": "Production",
  "nav.admin": "Gestion",
  "nav.signout": "Déconnexion",
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
  "nav.production": "Production",
  "nav.admin": "Admin",
  "nav.signout": "Sign out",
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
