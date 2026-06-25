import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";

export const controlCls =
  "w-full bg-superficie border border-borda text-texto rounded-lg px-3 py-2 text-sm placeholder:text-textoTen focus:outline-none focus:border-verde transition-colors";

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="block mb-1.5 text-xs font-medium text-textoSec">
      {children}
    </label>
  );
}

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${controlCls} ${className}`} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${controlCls} ${className}`}>
      {children}
    </select>
  );
}
