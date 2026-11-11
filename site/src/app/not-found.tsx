import Link from "@/components/HoverLink";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 pt-24 text-center">
      <div className="panel flex w-full flex-col items-center gap-4 p-10">
        <span className="serif grad text-[4rem] leading-none">404</span>
        <h1 className="h-sec text-[1.6rem]">This page doesn&apos;t exist</h1>
        <p className="text-sm text-t3">
          It may have moved, or the link is wrong.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/projects" className="btn btn-primary">
            Browse ideas
          </Link>
          <Link href="/" className="btn">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
