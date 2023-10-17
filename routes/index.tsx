import { useSignal } from "@preact/signals";
import Counter from "../islands/Counter.tsx";

export default function Home() {
  const count = useSignal(3);
  return (
    <div class="px-4 py-8 mx-auto bg-blue-300">
      <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center text-center">
        <img
          class="my-6"
          src="https://site-assets.plasmic.app/fd4e055b222749c879c6e042881ad65e.svg"
          width="128"
          height="128"
          alt="the Fresh logo: a sliced lemon dripping with juice"
        />

        <h1 class="text-4xl font-bold">Welcome to Fathym</h1>

        <h2 class="text-2xl my-4 font-bold">AI that doesn't just talk back.</h2>

        <p class="text-xl max-w-sm">
          With access to code, cloud and everything in between, Thinky makes,
          deploys, and runs your apps.
        </p>
      </div>
    </div>
  );
}
