import { PresentationControls } from '@react-three/drei'
import { vertexShader, fragmentShader } from './shaders/plane.glsl.js'
import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTweakpane } from './useTweakpane'

export default function Scene() {
  const materialRef = useRef()
  const meshRef = useRef()
  const params = useTweakpane(materialRef, meshRef)
  const { pointer, camera } = useThree()

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
      materialRef.current.uniforms.uMouse.value.set(pointer.x, pointer.y)
      materialRef.current.uniforms.cameraPosition.value.copy(camera.position)
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <PresentationControls
        // global={true}
        snap={true}
        enabled={true}
        cursor={false}
        speed={1}
        zoom={1}
        rotation={[0, 0, 0]}
        polar={[-Math.PI / 2, Math.PI / 2]}
        azimuth={[-Infinity, Infinity]}
        damping={0.4}
      >
        <mesh ref={meshRef} rotation={[0, 0, 0]}>
          <planeGeometry args={[params.current.size, params.current.size]} />
          <rawShaderMaterial
            ref={materialRef}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            glslVersion={THREE.GLSL3}
            side={THREE.DoubleSide}
            uniforms={{
              uTime: { value: 0 },
              uFactor: { value: 0.1 },
              uFactor2: { value: 0.1 },
              uMouse: { value: new THREE.Vector2(0, 0) },
              cameraPosition: { value: new THREE.Vector3(0, 0, 5) }
            }}
          />
        </mesh>
      </PresentationControls>
    </>
  )
}
