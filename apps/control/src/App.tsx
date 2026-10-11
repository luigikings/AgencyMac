import { useEffect } from "react";
import { APP_NAME, buildDocumentTitle } from "./lib/documentTitle";

export function App() {
  useEffect(() => {
    document.title = buildDocumentTitle();
  }, []);

  return (
    <main>
      <h1>{APP_NAME}</h1>
    </main>
  );
}
