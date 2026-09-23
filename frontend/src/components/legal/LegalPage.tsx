import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="border-b border-ggz-border pb-4">
        <h1 className="text-3xl font-bold text-ggz-text-primary">{title}</h1>
        <p className="mt-1 text-sm text-ggz-muted">Last updated: September 23, 2026</p>
      </header>
      <div className="mt-6 space-y-8">{children}</div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ggz-text-primary">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ggz-text-secondary [&_a]:text-ggz-amber [&_a]:hover:underline [&_li]:ml-5 [&_li]:list-disc [&_li]:mt-1 [&_strong]:font-semibold [&_strong]:text-ggz-text-primary [&_ul]:mt-1">
        {children}
      </div>
    </section>
  );
}

export function LegalTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr>
            {head.map((heading) => (
              <th
                key={heading}
                className="border border-ggz-border bg-ggz-bg-2 px-3 py-2 font-semibold text-ggz-text-primary"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border border-ggz-border px-3 py-2 align-top text-ggz-text-secondary"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
