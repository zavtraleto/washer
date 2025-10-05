import { useParams, Link } from 'react-router-dom';
import { useUIStore } from '@app/store/uiStore';

export function Play() {
  const { id } = useParams<{ id: string }>();
  const { cleanPercent, streak, jetOn, perfBudget } = useUIStore();

  return (
    <div>
      <h1>Playing: {id}</h1>
      <div>
        <p>Clean: {cleanPercent}%</p>
        <p>Streak: {streak}</p>
        <p>Jet: {jetOn ? 'ON' : 'OFF'}</p>
        <p>Performance: {perfBudget}</p>
      </div>
      <Link to="/">Back to Menu</Link>
    </div>
  );
}
