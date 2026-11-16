import { Button } from '../ui';

export function NotFound() {
  return (
    <section className="home-section notfound">
      <h1 className="home-h2">Page not found</h1>
      <p>This page doesn't exist. It may have moved: the Mod Toolkit is now at /toolkit and Dynasty at /dynasty.</p>
      <div className="home-actions">
        <Button href="/">Go to the homepage</Button>
        <Button variant="quiet" href="/toolkit">Open the Mod Toolkit</Button>
      </div>
    </section>
  );
}
