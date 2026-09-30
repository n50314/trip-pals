export const metadata = {
  title: "旅伴 Trip Pals",
  description: "和朋友一起整理旅行行程、景點與代購清單。",
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <head>
        <meta name="theme-color" content="#f6f1e8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/responsive.css" />
      </head>
      <body>
        {children}
        <script type="module" src="/app.js" />
      </body>
    </html>
  );
}
