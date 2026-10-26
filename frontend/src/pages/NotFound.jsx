import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <p className="mono" style={{ fontSize: 13, margin: '0 0 8px' }}>
        404 · route not found
      </p>
      <Link to="/app">Go to workspace</Link>
    </div>
  );
}
