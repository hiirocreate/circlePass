import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger";
};

export function Button({ variant = "primary", className, ...rest }: Props) {
  return (
    <button
      className={clsx(
        "w-full rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40",
        variant === "primary" && "bg-black text-white",
        variant === "outline" && "border border-black/20 text-black bg-white",
        variant === "danger" && "bg-red-600 text-white",
        className
      )}
      {...rest}
    />
  );
}
