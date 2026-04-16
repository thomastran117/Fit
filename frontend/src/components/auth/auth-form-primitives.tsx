import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, className, id, ...props }: FieldProps) {
  const resolvedId = id ?? props.name;

  return (
    <label htmlFor={resolvedId} className="block space-y-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <input
        {...props}
        id={resolvedId}
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${
          error ? "border-rose-300" : "border-slate-200"
        } ${className ?? ""}`}
      />
      {error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : hint ? (
        <p className="text-sm text-slate-500">{hint}</p>
      ) : null}
    </label>
  );
}

interface BannerProps {
  tone: "error" | "success" | "info";
  children: ReactNode;
}

export function Banner({ tone, children }: BannerProps) {
  const toneClasses = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  } as const;

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}

interface SubmitButtonProps {
  pending: boolean;
  children: ReactNode;
}

export function SubmitButton({ pending, children }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait..." : children}
    </button>
  );
}
