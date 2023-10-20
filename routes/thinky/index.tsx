import { SendIcon } from "$fathym/atomic-icons";
import { ChatInput } from "../../islands/_islands.tsx";
import { Handlers, PageProps } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(req, ctx) {
    // const resp = await synapticPluginDef.Handlers.ChatConvoLookup.GET!(req, ctx);

    // const messages: ConversationMessage[] = await resp.json();

    // messages.unshift({
    //   From: "assistant",
    //   Content:
    //     "Welcome to Harbor Research, providing AI powered industry knowledge.",
    // });

    return ctx.render({
      convoLookup: ctx.params.convoLookup,
      // messages: messages,
      newUserMessage: ctx.params.newUserMessage,
      // functions: await PageBlocks.Functions(),
      useOpenChat: !!ctx.params.useOpenChat,
    });
  },
  async POST(req, ctx) {
    const form = await req.formData();

    ctx.params.newUserMessage = form.get("content")?.toString() || "";

    ctx.params.useOpenChat = form.get("useOpenChat")?.toString() || "";

    return handler.GET!(req, ctx);
  },
};

export default function Thinky(props: PageProps) {
  return (
    <div class="mx-3 my-8 flex flex-col md:flex-row">
      <div class="w-full md:w-2/3 px-3 flex flex-col">
        <div class="h-[calc(100vh-57.5px]">asdf</div>

        <div>
          <ChatInput
            // icon=">"
            // icon={<SendIcon class="w-6 h-6" />}
            action="/thinky"
            // ref={chatInputRef}
            // useOpenChat={false}
            useOpenChat={props.data.useOpenChat}
            placeholder="What can Thinky do for you today? (Shift + Enter for a new line)"
          >
            <SendIcon class="w-6 h-6" />
          </ChatInput>
        </div>
      </div>

      <div class="w-full md:w-1/3 p-3">sdasdf</div>
    </div>
  );
}
