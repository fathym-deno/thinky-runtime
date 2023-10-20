import { PageProps } from "$fresh/server.ts";
import { ChatInput } from "../islands/_islands.tsx";
import { SendIcon } from "$fathym/atomic-icons";
import { Logo } from "@fathym/atomic";

export default function Home(props: PageProps) {
  return (
    <div>
      <div class="px-4 py-8 mx-auto bg-sky-600">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center text-center">
          <Logo />

          <h1 class="text-4xl font-bold">Welcome to Fathym</h1>

          <h2 class="text-2xl my-4 font-bold">
            AI that doesn't just talk back.
          </h2>

          <p class="text-xl max-w-sm">
            With access to code, cloud and everything in between, Thinky makes,
            deploys, and runs your apps.
          </p>
        </div>
      </div>

      <div class="max-w-screen-md mx-auto pt-12">
        <ChatInput
          // icon=">"
          // icon={<SendIcon class="w-6 h-6" />}
          action="/thinky"
          // ref={chatInputRef}
          // useOpenChat={false}
          hideOpenChat
          placeholder="What can Thinky do for you today? (Shift + Enter for a new line)"
        >
          <SendIcon class="w-6 h-6" />
        </ChatInput>
      </div>
    </div>
  );
}
