import Link from "next/link";

export function BackLink({ href, label = "戻る" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="mb-2 inline-block text-sm text-black/50 hover:text-black">
      ← {label}
    </Link>
  );
}
