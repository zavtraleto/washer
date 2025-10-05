import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Menu } from '@app/routes/Menu';
import { Play } from '@app/routes/Play';
import { Gallery } from '@app/routes/Gallery';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/play/:id" element={<Play />} />
        <Route path="/gallery" element={<Gallery />} />
      </Routes>
    </BrowserRouter>
  );
}
