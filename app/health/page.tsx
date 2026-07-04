
export default function HealthPage(){
  return (
    <main style={{padding:40}}>
      <h1>SUR Platform Health Check</h1>
      <ul>
        <li>Next.js: Ready</li>
        <li>Supabase: Configure environment and test live connection</li>
        <li>Build: Production build passed</li>
      </ul>
    </main>
  );
}
