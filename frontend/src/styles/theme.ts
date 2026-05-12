export const theme = {
  colors: {
    brand: {
      solid: "bg-violet-600",
      solidHover: "hover:bg-violet-700",
      text: "text-violet-700",
      softText: "text-violet-600",
      softBg: "bg-violet-50",
      border: "border-violet-500",
      softBorder: "border-violet-100",
      ring: "focus-within:ring-violet-500/10",
      shadow: "shadow-violet-600/20",
    },

    neutral: {
      page: "bg-white",
      subtlePage: "bg-slate-50",
      text: "text-slate-950",
      mutedText: "text-slate-500",
      secondaryText: "text-slate-600",
      border: "border-slate-200",
      softBorder: "border-slate-200/80",
      dark: "bg-slate-950",
      darkHover: "hover:bg-slate-800",
    },

    danger: {
      text: "text-rose-700",
      softBg: "hover:bg-rose-50",
    },
  },

  header: {
    shell:
      "sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl transition-shadow duration-200 supports-[backdrop-filter]:bg-white/80",

    container:
      "mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8",

    logoMark:
      "flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold tracking-[0.12em] text-white shadow-sm shadow-violet-600/20 transition duration-200 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-violet-600/25",

    navLink:
      "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-950",

    navLinkActive:
      "rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition duration-200 hover:-translate-y-0.5",

    searchWrapper:
      "group flex h-11 w-full min-w-[360px] max-w-xl items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 transition duration-200 focus-within:scale-[1.01] focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10 xl:min-w-[440px]",

    mobileSearchWrapper:
      "group flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition duration-200 focus-within:scale-[1.01] focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10",

    searchIcon:
      "text-slate-400 transition duration-200 group-focus-within:text-violet-600",

    searchInput:
      "min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400",

    searchButton:
      "rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-md hover:shadow-violet-600/25 active:translate-y-0",

    secondaryAction:
      "rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 transition duration-200 hover:-translate-y-0.5 hover:bg-violet-50",

    menuButton:
      "flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition duration-200 hover:scale-105 hover:bg-slate-50 active:scale-95",

    mobileDropdown:
      "fixed left-0 right-0 top-16 z-50 border-b border-slate-200 bg-white shadow-xl shadow-slate-950/10 animate-mobile-dropdown-in",

    dropdown:
      "absolute right-0 top-[calc(100%+0.75rem)] w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10 animate-dropdown-in",

    dropdownHighlight:
      "rounded-xl border border-violet-100 bg-violet-50 p-3",

    dropdownItem:
      "rounded-xl px-3 py-2.5 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100",

    logoutButton:
      "cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-700 transition duration-200 hover:-translate-y-0.5 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60",

    mobileNavLink:
      "rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-950",

    mobileNavLinkActive:
      "rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 transition duration-200 hover:-translate-y-0.5",

    mobileCta:
      "group flex items-center justify-between rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-md hover:shadow-violet-600/20 active:translate-y-0",

    desktopAccountTrigger:
      "flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm transition duration-200 hover:scale-[1.02] hover:bg-slate-50 active:scale-[0.98]",

    authButton:
      "rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50",

    authButtonDark:
      "rounded-xl bg-slate-950 px-3 py-2.5 text-center text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800",
  },

footer: {
  shell: "border-t border-slate-200 bg-white",

  container:
    "mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8",

  sectionTitle:
    "text-sm font-semibold text-slate-950",

  description:
    "mt-5 max-w-md text-sm leading-7 text-slate-600",

  link:
    "text-sm text-slate-600 transition duration-200 hover:text-violet-700",

  socialLink:
    "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700",

  metaBar:
    "flex flex-col gap-4 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between",

  legalLink:
    "text-sm text-slate-500 transition duration-200 hover:text-violet-700",
  },
} as const;
