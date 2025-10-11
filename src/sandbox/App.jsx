import { Canvas } from '@react-three/fiber'
import { Perf } from 'r3f-perf'
import Scene from './Scene'
import './App.css'

function App() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}>
      <Canvas gl={{ antialias: true }}>
        <Perf position="top-left" />
        <Scene />
      </Canvas>
    </div>
  )
}

export default App
