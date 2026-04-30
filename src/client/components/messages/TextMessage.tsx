import Markdown from "react-markdown"
import type { ProcessedTextMessage } from "./types"
import { createMarkdownComponents } from "./shared"
import { remarkPlugins, rehypePlugins } from "./markdown-plugins"

interface Props {
  message: ProcessedTextMessage
}

export function TextMessage({ message }: Props) {
  return (
    // <VerticalLineContainer className="w-full">
      <div className="text-pretty prose prose-sm dark:prose-invert px-0.5 w-full max-w-full space-y-4">
        <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={createMarkdownComponents()}>{message.text}</Markdown>
      </div>
    // </VerticalLineContainer>
  )
}
