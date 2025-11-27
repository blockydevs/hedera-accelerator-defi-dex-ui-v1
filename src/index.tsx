import { enableMapSet } from "immer";
import { createRoot } from "react-dom/client";
import { DAO } from "@dao";
import { DEXStoreProvider } from "@dex/context";
import { initializeServices } from "@dex/services";
import { DEFAULT_DEX_PROVIDER_PROPS } from "@dex/store";

/** Needed to enable immutable immer updates on Map and Set objects. */
enableMapSet();

initializeServices().then(() => {
  const container = document.getElementById("root") as HTMLElement;
  const root = createRoot(container);

  function getApp(): React.ReactNode {
    return <DAO />;
  }

  root.render(<DEXStoreProvider {...DEFAULT_DEX_PROVIDER_PROPS}>{getApp()}</DEXStoreProvider>);
});
