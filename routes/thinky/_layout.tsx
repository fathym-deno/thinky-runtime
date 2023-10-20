import { LayoutProps } from "$fresh/server.ts";
import { FathymHeader } from "@fathym/atomic";

export default function Layout({ Component }: LayoutProps) {
  return (
    <>
      <FathymHeader />

      <Component />
    </>
  );
}
