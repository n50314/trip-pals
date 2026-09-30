import { readFileSync } from "node:fs";
import { join } from "node:path";

export default function HomePage() {
  const html = readFileSync(join(process.cwd(), "public", "index.html"), "utf8");
  const body = html.match(/<body>([\s\S]*?)<script type="module"/)?.[1] || "";

  return <div dangerouslySetInnerHTML={{ __html: body }} />;
}
