import type { FormEvent, Ref } from "react";
import { theme } from "@/styles/theme";
import { SearchIcon } from "./site-header.shared";

type SearchFormVariant = "desktop" | "mobile";

const searchFormVariants = {
  desktop: {
    formClassName: theme.header.searchForm,
    wrapperClassName: theme.header.searchWrapper,
  },
  mobile: {
    formClassName: "w-full",
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
  inputRef?: Ref<HTMLInputElement>;
}

export function SiteHeaderSearchForm({
  query,
  onQueryChange,
  onSubmit,
  variant,
  inputRef,
}: SiteHeaderSearchFormProps) {
  const classes = searchFormVariants[variant];

  return (
    <form onSubmit={onSubmit} className={classes.formClassName} role="search">
      <div className={classes.wrapperClassName}>
        <div className={theme.header.searchIcon}>
          <SearchIcon />
        </div>

        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search rentals, equipment, spaces..."
          aria-label="Search rentals, equipment, and spaces"
          className={theme.header.searchInput}
        />

        <button type="submit" className={theme.header.searchSubmit}>
          Search
        </button>
      </div>
    </form>
  );
}
