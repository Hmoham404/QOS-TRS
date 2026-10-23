import { MotionConfig } from "motion/react";
import { t as translate } from "./i18n.js";
import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import App from "./App";
import "./styles.css";
import "./upgrade.css";
import "./vision.css";
import "./daily.css";
import "./journal-clock.css";
import "./pwa.css";
import "./workspace.css";
import "./refinement.css";
import "./theme.css";
import "./theme.js";
import { startPwa } from "./pwa";
startPwa();
class ErrorBoundary extends React.Component {
  state = {
    error: null
  };
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  render() {
    return this.state.error ? <main className="fatal"><h1>{translate("Impossible d’ouvrir l’atelier")}</h1><p>{translate(this.state.error.message)}</p><button onClick={() => location.reload()}>{translate("Réessayer")}</button><p>{translate("Vos données enregistrées sont conservées.")}</p></main> : this.props.children;
  }
}
createRoot(document.getElementById("root")).render(<React.StrictMode><MotionConfig reducedMotion="user" transition={{duration:0.35}}><ErrorBoundary><App /></ErrorBoundary></MotionConfig></React.StrictMode>);
