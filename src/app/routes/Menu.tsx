import { Link } from 'react-router-dom';

export function Menu() {
  return (
    <div>
      <h1>Washer - Main Menu</h1>
      <nav>
        <ul>
          <li>
            <Link to="/play/level-1">Play Level 1</Link>
          </li>
          <li>
            <Link to="/gallery">Gallery</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
