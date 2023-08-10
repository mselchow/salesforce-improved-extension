import * as React from "react";
import * as ReactDOM from "react-dom/client";

import "@/styles/globals.css";
import { Toaster } from "@/components/ui/toaster";

import Options from "./Options";

ReactDOM.createRoot(document.getElementById("__root")!).render(
  <React.StrictMode>
    <Options />
    <Toaster />
  </React.StrictMode>
);
