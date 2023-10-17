import { Action, Input } from "@fathym/atomic";

export default function Thinky() {
  return (
    <div>
      <div class="px-4 py-8 mx-auto bg-blue-300">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center text-center">
          <img
            class="my-6"
            src="https://site-assets.plasmic.app/fd4e055b222749c879c6e042881ad65e.svg"
            width="128"
            height="128"
            alt="the Fresh logo: a sliced lemon dripping with juice"
          />

          <h1 class="text-4xl font-bold">Welcome to Thinky</h1>

          <h2 class="text-2xl my-4 font-bold">
            AI that doesn't just talk back.
          </h2>

          <p class="text-xl max-w-sm">
            With access to code, cloud and everything in between, Thinky makes,
            deploys, and runs your apps.
          </p>
        </div>
      </div>

      <form
        method="post"
        action="/thinky"
        class="max-w-screen-md mx-auto flex flex-col items-center justify-center text-center md:flex-row p-8"
      >
        <Input
          multiline
          class="w-full px-3 py-2 my-2 text-lg leading-tight text-gray-700 bg-white border rounded shadow appearance-none focus:outline-none focus:shadow-outline md:my-0 md:mr-2"
          type="text"
          placeholder="What can Thinky do for you today?"
        />

        <Action
          type="submit"
          class="w-full px-4 py-2 my-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline md:w-auto md:my-0"
        >
          Chat
        </Action>
      </form>
    </div>
  );
}
