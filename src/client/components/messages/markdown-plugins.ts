import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { PluggableList } from "unified"

export const remarkPlugins: PluggableList = [remarkGfm, remarkMath]
export const rehypePlugins: PluggableList = [rehypeKatex]
