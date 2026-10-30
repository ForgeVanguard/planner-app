import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Planner App</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; background: #10141A; color: #F4F1EA; }
              body { margin: 0; }
              textarea, input { font-size: 17px; }
              textarea { field-sizing: content; }
              :focus-visible { outline: 3px solid #E4B56A; outline-offset: 2px; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
