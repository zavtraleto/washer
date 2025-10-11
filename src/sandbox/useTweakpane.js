import { useEffect, useRef } from 'react'
import { Pane } from 'tweakpane'
import * as THREE from 'three'

export function useTweakpane(materialRef, meshRef) {
  const paramsRef = useRef(
    { size: 5,
      factor1: 0.1, 
      factor2: 0.1, 

    }
  )

  useEffect(() => {
    setupTweakpane(materialRef, meshRef, paramsRef)
  }, [materialRef, meshRef])

  return paramsRef
}

export function setupTweakpane(materialRef, meshRef, paramsRef) {
  const pane = new Pane({ title: 'Controls' })

  const size = pane.addBinding(paramsRef.current, 'size', {
      min: 2,
      max: 20,
      step: 1,
      label: 'Plane Size'
    }).on('change', () => {
      if (meshRef.current) {
        meshRef.current.geometry.dispose()
        const newGeometry = new THREE.PlaneGeometry(paramsRef.current.size, paramsRef.current.size)
        meshRef.current.geometry = newGeometry
      }
    })
    const factor1 = pane.addBinding(paramsRef.current, 'factor1', {
      min: -0.5,
      max: 0.5,
      step: 0.01,
      label: 'Factor'
    }).on('change', () => {
      if (materialRef.current) {
        materialRef.current.uniforms.uFactor.value = paramsRef.current.factor1
      }
    })
    const factor2 = pane.addBinding(paramsRef.current, 'factor2', {
      min: -0.5,
      max: 0.5,
      step: 0.01,
      label: 'Factor2'
    }).on('change', () => {
      if (materialRef.current) {
        materialRef.current.uniforms.uFactor2.value = paramsRef.current.factor2
      }
    })

  return () => pane.dispose()
}
