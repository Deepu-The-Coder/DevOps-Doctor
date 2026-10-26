import { HACKATHON_NAME } from '../data/site.js';

export default function Footer() {
  return (
    <footer className="site-footer mono">
      Gemma 4 · Google AI Studio{HACKATHON_NAME ? ` · built at ${HACKATHON_NAME}` : ''}
    </footer>
  );
}
