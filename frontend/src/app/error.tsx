"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-2xl px-5 py-24 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-ggz-amber">Connection interrupted</p><h1 className="mt-3 text-3xl font-bold">We couldn’t load GGz.</h1><p className="my-5 text-ggz-text-secondary">Please try again in a moment. Your account and activity are safe.</p><button onClick={reset} className="rounded-xl bg-ggz-amber px-6 py-3 font-semibold text-black">Try again</button></div>;
}
