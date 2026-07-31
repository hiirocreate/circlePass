import { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-2xl border border-black/10 bg-white p-4 shadow-sm", className)}
      {...rest}
    />
  );
}
