/* Original, monochrome workshop emblems. Color comes from the department theme. */
function Emblem({ children, size = 24, strokeWidth = 1.7, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}
export function InjectionLogo(props) {
  return <Emblem {...props}><path d="M5 7h7v18H5zM20 7h7v18h-7M2 12h3m-3 8h3m22-8h3m-3 8h3M12 12h3m2 8h3"/><path d="M16 6v5c0 2.4 3 3.6 3 6a3 3 0 0 1-6 0c0-2.4 3-3.6 3-6"/><path d="M9 3h14M9 29h14" opacity=".45"/></Emblem>;
}
export function AssemblyLogo(props) {
  return <Emblem {...props}><path d="m16 3 11 6-11 6L5 9zM5 15l11 6 11-6M5 21l11 6 11-6"/><path d="M16 15v12M5 9v6m22-6v6" opacity=".5"/><path d="m12 9 3 2 5-3"/></Emblem>;
}
export function MetallizationLogo(props) {
  return <Emblem {...props}><path d="m5 10 11-6 11 6v13l-11 6-11-6z"/><path d="m5 10 11 6 11-6M16 16v13" opacity=".5"/><path d="m9 17 3 2v5m8-3 3-2"/><path d="M24 1v8m-4-4h8" strokeWidth="2"/><path d="m8 6 5-3" opacity=".5"/></Emblem>;
}
export function ScreenPrintingLogo(props) {
  return <Emblem {...props}><path d="M5 11v16h22V11M8 23h16"/><path d="m8 5 18 4-2 7-18-4zM10 12l-2 7h17l-1-3"/><path d="m12 7 1-4 9 2-1 4"/><path d="M11 27v3m10-3v3" opacity=".5"/></Emblem>;
}
export function WeldingLogo(props) {
  return <Emblem {...props}><path d="m5 4 10 10-5 5L2 11M13 17l4 4M4 28h24M19 25l3-3 4 3"/><path d="m21 5-3 6m10 1-6 3m7 5-6-1M16 2v5"/><path d="m17 17 3 3" strokeWidth="3"/></Emblem>;
}
