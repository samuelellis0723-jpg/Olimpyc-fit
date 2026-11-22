export default function Brand({ compact = false }) {
  return (
    <a className={`brand ${compact ? 'brand--compact' : ''}`} href="#inicio" aria-label="Olimpyc Fit, inicio">
      <svg className="brand__mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M34.8 8.4A19.4 19.4 0 1 0 42 25.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4.2" />
        <path d="m35.8 5.5 7.2 2.7-1.1 7.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" />
      </svg>
      <span>olimpyc<span className="brand__fit">fit</span></span>
    </a>
  );
}
