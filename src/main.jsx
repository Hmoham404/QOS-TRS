import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import App from './App';
import './styles.css';
import './upgrade.css';
import './vision.css';
import './daily.css';
import './journal-clock.css';
class ErrorBoundary extends React.Component {
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<main className="fatal"><h1>Impossible d’ouvrir l’atelier</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>Réessayer</button><p>Vos données enregistrées sont conservées.</p></main>:this.props.children;}
}
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
