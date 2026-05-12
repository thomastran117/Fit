import type { FormEvent } from "react";
import { theme } from "@/styles/theme";
import { SearchIcon } from "./site-header.shared";

type SearchFormVariant = "desktop" | "mobile";

const searchFormVariants = {
  desktop: {
    formClassName: "hidden min-w-0 flex-1 justify-center xl:flex",
    wrapperClassName: theme.header.searchWrapper,
  },
  mobile: {
    formClassName: "pb-4",
    wrapperClassName: theme.header.mobileSearchWrapper,
  },
} as const satisfies Record<
  SearchFormVariant,
  { formClassName: string; wrapperClassName: string }
>;

interface SiteHeaderSearchFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  variant: SearchFormVariant;
}

export function SiteHeaderSearchForm({
  query,
  onQueryChange,
  onSubmit,
  variant,
}: SiteHeaderSearchFormProps) {
  const classes = searchFormVariants[variant];

  return (
    <form onSubmit={onSubmit} className={classes.formClassName}>
      <div className={classes.wrapperClassName}>
        <div className={theme.header.searchIcon}>
          <SearchIcon />
        </div>

        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search rentals, equipment, spaces..."
          aria-label="Search rentals, equipment, and spaces"
          className={theme.header.searchInput}
        />

        <button type="submit" className={theme.header.searchButton}>
          Search
        </button>
      </div>
    </form>
  );
}
